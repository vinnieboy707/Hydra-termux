// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IBalancerVault {
    function flashLoan(
        address recipient,
        IERC20[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface ISwapRouter {
    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 deadline,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountOut);
}

contract ChronosFlashArbitrageMaxOptimized {
    address public immutable owner;
    address public immutable balancerVault;
    
    // EIP-55 Checksummed Arbitrum SwapRouter02
    address public constant SWAP_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;

    event ArbitrageExecuted(address indexed token, uint256 amountBorrowed, uint256 profitGenerated, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _balancerVault) {
        owner = msg.sender;
        balancerVault = _balancerVault;
    }

    function initiateFlashLoan(
        address tokenToBorrow,
        uint256 borrowAmount,
        bytes calldata arbitrageData
    ) external onlyOwner {
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(tokenToBorrow);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = borrowAmount;

        IBalancerVault(balancerVault).flashLoan(
            address(this),
            tokens,
            amounts,
            arbitrageData
        );
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(msg.sender == balancerVault, "Unauthorized vault callback");

        IERC20 borrowedToken = tokens[0];
        uint256 amountBorrowed = amounts[0];
        uint256 totalDebt = amountBorrowed + feeAmounts[0];

        (
            address routerLeg1,
            address tokenOutLeg1,
            uint24 feeLeg1,
            address routerLeg2,
            uint24 feeLeg2,
            uint256 minRequiredProfit
        ) = abi.decode(userData, (address, address, uint24, address, uint24, uint256));

        address intermediateToken = tokenOutLeg1;

        // --- LEG 1 ---
        IERC20(address(borrowedToken)).approve(routerLeg1, amountBorrowed);
        uint256 intermediateBal = ISwapRouter(routerLeg1).exactInputSingle(
            address(borrowedToken),
            intermediateToken,
            feeLeg1,
            address(this),
            block.timestamp,
            amountBorrowed,
            1,
            0
        );
        require(intermediateBal > 0, "Leg 1 zero output");

        // --- LEG 2 ---
        IERC20(intermediateToken).approve(routerLeg2, intermediateBal);
        uint256 finalBalance = ISwapRouter(routerLeg2).exactInputSingle(
            intermediateToken,
            address(borrowedToken),
            feeLeg2,
            address(this),
            block.timestamp,
            intermediateBal,
            totalDebt + minRequiredProfit,
            0
        );

        // --- PROFITABILITY & SETTLEMENT ---
        require(finalBalance >= totalDebt + minRequiredProfit, "Insufficient arbitrage profit");
        uint256 netProfit = finalBalance - totalDebt;

        // Repay Balancer Flash Loan
        require(borrowedToken.transfer(balancerVault, totalDebt), "Repayment failed");

        // Sweep Net Profit to Owner Wallet
        if (netProfit > 0) {
            require(borrowedToken.transfer(owner, netProfit), "Owner profit transfer failed");
        }

        emit ArbitrageExecuted(address(borrowedToken), amountBorrowed, netProfit, block.timestamp);
    }

    function rescueFunds(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
}
