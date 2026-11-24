// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IBalancerVault {
    function flashLoan(address recipient, IERC20[] memory tokens, uint256[] memory amounts, bytes memory userData) external;
}

interface ISwapRouterV1 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAlgebraRouter {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; address recipient;
        uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 limitSqrtPrice;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract ChronosFlashArbitrageV3 {
    error Unauthorized();
    error Expired();
    error InsufficientProfit(uint256 finalBalance, uint256 required);
    error SwapLegFailed(uint256 legIndex);

    struct SwapLeg {
        address router;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint8 routerType; // 0 = V1 (with deadline), 1 = SwapRouter02, 2 = Camelot Algebra
    }

    address public immutable owner;
    address public immutable balancerVault;

    event ArbitrageV3Settled(address indexed borrowedToken, uint256 borrowedAmount, uint256 netProfit, uint256 legCount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _balancerVault) {
        owner = msg.sender;
        balancerVault = _balancerVault;
    }

    function initiateFlashLoan(address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external onlyOwner {
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(tokenToBorrow);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = borrowAmount;
        IBalancerVault(balancerVault).flashLoan(address(this), tokens, amounts, arbitrageData);
    }

    function receiveFlashLoan(IERC20[] memory tokens, uint256[] memory amounts, uint256[] memory feeAmounts, bytes memory userData) external {
        if (msg.sender != balancerVault) revert Unauthorized();

        (SwapLeg[] memory legs, uint256 minRequiredProfit, uint256 deadline) = abi.decode(userData, (SwapLeg[], uint256, uint256));
        if (block.timestamp > deadline) revert Expired();

        IERC20 borrowedToken = tokens[0];
        uint256 amountBorrowed = amounts[0];
        uint256 totalDebt = amountBorrowed + feeAmounts[0];
        uint256 currentAmount = amountBorrowed;

        for (uint256 i = 0; i < legs.length; i++) {
            SwapLeg memory leg = legs[i];
            if (IERC20(leg.tokenIn).allowance(address(this), leg.router) < currentAmount) {
                IERC20(leg.tokenIn).approve(leg.router, type(uint256).max);
            }

            if (leg.routerType == 0) {
                currentAmount = ISwapRouterV1(leg.router).exactInputSingle(
                    ISwapRouterV1.ExactInputSingleParams(leg.tokenIn, leg.tokenOut, leg.fee, address(this), deadline, currentAmount, 1, 0)
                );
            } else if (leg.routerType == 1) {
                currentAmount = ISwapRouter02(leg.router).exactInputSingle(
                    ISwapRouter02.ExactInputSingleParams(leg.tokenIn, leg.tokenOut, leg.fee, address(this), currentAmount, 1, 0)
                );
            } else {
                currentAmount = IAlgebraRouter(leg.router).exactInputSingle(
                    IAlgebraRouter.ExactInputSingleParams(leg.tokenIn, leg.tokenOut, address(this), deadline, currentAmount, 1, 0)
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

        emit ArbitrageV3Settled(address(borrowedToken), amountBorrowed, netProfit, legs.length);
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
