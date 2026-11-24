// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IBalancerVault {
    function flashLoan(
        address recipient,
        IERC20[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

// Legacy Uniswap V3 / PancakeSwap V3 SwapRouter (with deadline - selector 0x414bf389)
interface ISwapRouterV1 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// Modern SwapRouter02 / SushiSwap V3 (without deadline - selector 0x04e45aaf)
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract ChronosFlashArbitrageV2 {
    error Unauthorized();
    error InsufficientProfit(uint256 finalBalance, uint256 required);
    error SwapLegFailed(uint256 legIndex);

    struct SwapLeg {
        address router;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        bool isRouter02; // false = 8-field ISwapRouterV1 (with deadline), true = 7-field ISwapRouter02
    }

    address public immutable owner;
    address public immutable balancerVault;

    event ArbitrageV2Settled(address indexed borrowedToken, uint256 borrowedAmount, uint256 netProfit, uint256 legCount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
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

        IBalancerVault(balancerVault).flashLoan(address(this), tokens, amounts, arbitrageData);
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        if (msg.sender != balancerVault) revert Unauthorized();

        IERC20 borrowedToken = tokens[0];
        uint256 amountBorrowed = amounts[0];
        uint256 totalDebt = amountBorrowed + feeAmounts[0];

        (SwapLeg[] memory legs, uint256 minRequiredProfit) = abi.decode(userData, (SwapLeg[], uint256));

        uint256 currentAmount = amountBorrowed;

        for (uint256 i = 0; i < legs.length; i++) {
            SwapLeg memory leg = legs[i];
            if (IERC20(leg.tokenIn).allowance(address(this), leg.router) < currentAmount) {
                IERC20(leg.tokenIn).approve(leg.router, type(uint256).max);
            }

            if (leg.isRouter02) {
                currentAmount = ISwapRouter02(leg.router).exactInputSingle(
                    ISwapRouter02.ExactInputSingleParams({
                        tokenIn: leg.tokenIn,
                        tokenOut: leg.tokenOut,
                        fee: leg.fee,
                        recipient: address(this),
                        amountIn: currentAmount,
                        amountOutMinimum: 1,
                        sqrtPriceLimitX96: 0
                    })
                );
            } else {
                currentAmount = ISwapRouterV1(leg.router).exactInputSingle(
                    ISwapRouterV1.ExactInputSingleParams({
                        tokenIn: leg.tokenIn,
                        tokenOut: leg.tokenOut,
                        fee: leg.fee,
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: currentAmount,
                        amountOutMinimum: 1,
                        sqrtPriceLimitX96: 0
                    })
                );
            }

            if (currentAmount == 0) revert SwapLegFailed(i);
        }

        uint256 requiredTotal = totalDebt + minRequiredProfit;
        if (currentAmount < requiredTotal) revert InsufficientProfit(currentAmount, requiredTotal);

        uint256 netProfit = currentAmount - totalDebt;
        require(borrowedToken.transfer(balancerVault, totalDebt), "Repayment failed");

        if (netProfit > 0) {
            require(borrowedToken.transfer(owner, netProfit), "Profit transfer failed");
        }

        emit ArbitrageV2Settled(address(borrowedToken), amountBorrowed, netProfit, legs.length);
    }

    function rescueFunds(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function rescueETH() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {}
}
