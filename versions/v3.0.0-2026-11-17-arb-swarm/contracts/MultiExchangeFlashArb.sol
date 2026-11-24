// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFlashLoanPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IUniswapV3Router {
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

/**
 * @title MultiExchangeFlashArb
 * @notice Executes atomic multi-hop arbitrage across Uniswap V3, SushiSwap, Camelot, and Balancer/Aave flash liquidity.
 */
contract MultiExchangeFlashArb {
    address public immutable owner;
    IFlashLoanPool public immutable aavePool;

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_AUTHORIZED");
        _;
    }

    constructor(address _aavePool) {
        owner = msg.sender;
        aavePool = IFlashLoanPool(_aavePool);
    }

    // Initiate Flash Loan Arbitrage
    function executeArbitrage(
        address asset,
        uint256 amount,
        bytes calldata swapParams
    ) external onlyOwner {
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // 0 = no debt, repay immediately in callback

        aavePool.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            swapParams,
            0
        );
    }

    // Aave FlashLoan Callback Receiver
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == address(aavePool), "INVALID_CALLER");
        require(initiator == address(this), "INVALID_INITIATOR");

        address tokenBorrowed = assets[0];
        uint256 amountBorrowed = amounts[0];
        uint256 totalDebt = amountBorrowed + premiums[0];

        // Decode multi-exchange routing parameters from calldata
        (
            address routerA,
            address routerB,
            address intermediateToken,
            uint24 feeA,
            uint24 feeB,
            uint256 minProfitOut
        ) = abi.decode(params, (address, address, address, uint24, uint24, uint256));

        // Step 1: Swap borrowed token for intermediate token on Exchange A
        IERC20(tokenBorrowed).approve(routerA, amountBorrowed);
        IUniswapV3Router.ExactInputSingleParams memory paramsA = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenBorrowed,
            tokenOut: intermediateToken,
            fee: feeA,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountBorrowed,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        uint256 amountIntermediate = IUniswapV3Router(routerA).exactInputSingle(paramsA);

        // Step 2: Swap intermediate token back to borrowed token on Exchange B
        IERC20(intermediateToken).approve(routerB, amountIntermediate);
        IUniswapV3Router.ExactInputSingleParams memory paramsB = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: intermediateToken,
            tokenOut: tokenBorrowed,
            fee: feeB,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIntermediate,
            amountOutMinimum: totalDebt + minProfitOut, // Enforces strict net profit hurdle
            sqrtPriceLimitX96: 0
        });
        uint256 finalBalance = IUniswapV3Router(routerB).exactInputSingle(paramsB);

        // Ensure flash loan repayment is fully covered plus net profit
        require(finalBalance >= totalDebt + minProfitOut, "PROFIT_HURDLE_NOT_MET");

        // Repay Flash Loan
        IERC20(tokenBorrowed).approve(address(aavePool), totalDebt);

        // Transfer remaining profit to owner
        uint256 profit = finalBalance - totalDebt;
        if (profit > 0) {
            IERC20(tokenBorrowed).transfer(owner, profit);
        }

        return true;
    }

    // Emergency withdrawal helper
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
}
