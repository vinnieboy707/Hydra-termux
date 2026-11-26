// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IAavePool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
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

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title ChronosFlashArb
/// @notice Aave V3 flash-loan arbitrage executor. Reverts unless the trade is net-profitable.
contract ChronosFlashArb is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum Dex { UniV3, UniV2 }

    struct Leg {
        Dex dex;
        address router;   // must be allowlisted
        address tokenOut; // tokenIn is the previous leg's tokenOut (leg 0: the borrowed asset)
        uint24 fee;       // UniV3 pool fee tier; ignored for UniV2
        uint256 minOut;   // per-leg slippage floor
    }

    uint8 public constant MAX_LEGS = 4;

    IAavePool public immutable POOL;

    mapping(address => bool) public operators;
    mapping(address => bool) public allowedRouters;
    mapping(address => uint256) public maxLoan; // 0 = asset not allowed

    event Arbitrage(address indexed asset, uint256 amount, uint256 premium, uint256 profit);
    event OperatorSet(address indexed operator, bool allowed);
    event RouterSet(address indexed router, bool allowed);
    event MaxLoanSet(address indexed asset, uint256 cap);
    event Withdrawn(address indexed token, uint256 amount);

    error NotOperator();
    error BadCaller();
    error Expired();
    error LoanNotAllowed();
    error BadLegs();
    error RouterNotAllowed();
    error ZeroMinProfit();
    error Slippage();
    error Unprofitable(uint256 endBalance, uint256 required);
    error ZeroAddress();
    error RenounceDisabled();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(address pool) Ownable(msg.sender) {
        if (pool == address(0)) revert ZeroAddress();
        POOL = IAavePool(pool);
    }

    // ---------------------------------------------------------------- trading

    /// @return profit net profit in `asset` units, after the flash-loan premium
    function execute(
        address asset,
        uint256 amount,
        uint256 minProfit,
        uint256 deadline,
        Leg[] calldata legs
    ) external onlyOperator nonReentrant whenNotPaused returns (uint256 profit) {
        if (block.timestamp > deadline) revert Expired();
        if (minProfit == 0) revert ZeroMinProfit();

        uint256 cap = maxLoan[asset];
        if (cap == 0 || amount == 0 || amount > cap) revert LoanNotAllowed();

        uint256 n = legs.length;
        if (n < 2 || n > MAX_LEGS) revert BadLegs();
        address prev = asset;
        for (uint256 i; i < n; ++i) {
            if (!allowedRouters[legs[i].router]) revert RouterNotAllowed();
            if (legs[i].tokenOut == address(0) || legs[i].tokenOut == prev) revert BadLegs();
            prev = legs[i].tokenOut;
        }
        if (prev != asset) revert BadLegs(); // must end in the borrowed asset

        uint256 balBefore = IERC20(asset).balanceOf(address(this));
        POOL.flashLoanSimple(address(this), asset, amount, abi.encode(minProfit, deadline, legs), 0);
        profit = IERC20(asset).balanceOf(address(this)) - balBefore;
    }

    /// @dev Aave callback.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // only the pool, only for loans started by execute() (nonReentrant lock is held)
        if (msg.sender != address(POOL) || initiator != address(this) || !_reentrancyGuardEntered())
            revert BadCaller();

        (uint256 minProfit, uint256 deadline, Leg[] memory legs) =
            abi.decode(params, (uint256, uint256, Leg[]));

        uint256 startBal = IERC20(asset).balanceOf(address(this)); // includes the loan
        address tokenIn = asset;
        uint256 amountIn = amount;
        for (uint256 i; i < legs.length; ++i) {
            amountIn = _swap(legs[i], tokenIn, amountIn, deadline);
            tokenIn = legs[i].tokenOut;
        }

        // endBal must cover: starting balance (incl. principal) + premium + minimum profit
        uint256 endBal = IERC20(asset).balanceOf(address(this));
        uint256 required = startBal + premium + minProfit;
        if (endBal < required) revert Unprofitable(endBal, required);

        IERC20(asset).forceApprove(address(POOL), amount + premium); // pool pulls this after return
        emit Arbitrage(asset, amount, premium, endBal - startBal - premium);
        return true;
    }

    function _swap(Leg memory leg, address tokenIn, uint256 amountIn, uint256 deadline)
        internal
        returns (uint256 received)
    {
        IERC20 out = IERC20(leg.tokenOut);
        uint256 balBefore = out.balanceOf(address(this));

        IERC20(tokenIn).forceApprove(leg.router, amountIn);
        if (leg.dex == Dex.UniV3) {
            IUniswapV3Router(leg.router).exactInputSingle(
                IUniswapV3Router.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: leg.tokenOut,
                    fee: leg.fee,
                    recipient: address(this),
                    deadline: deadline,
                    amountIn: amountIn,
                    amountOutMinimum: leg.minOut,
                    sqrtPriceLimitX96: 0
                })
            );
        } else {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = leg.tokenOut;
            IUniswapV2Router(leg.router).swapExactTokensForTokens(
                amountIn, leg.minOut, path, address(this), deadline
            );
        }
        IERC20(tokenIn).forceApprove(leg.router, 0);

        received = out.balanceOf(address(this)) - balBefore; // measured, never trusted from the router
        if (received < leg.minOut) revert Slippage();
    }

    // ------------------------------------------------------------------ admin

    function setOperator(address op, bool allowed) external onlyOwner {
        operators[op] = allowed;
        emit OperatorSet(op, allowed);
    }

    function setRouter(address router, bool allowed) external onlyOwner {
        allowedRouters[router] = allowed;
        emit RouterSet(router, allowed);
    }

    /// @notice cap in asset units; 0 disables the asset
    function setMaxLoan(address asset, uint256 cap) external onlyOwner {
        maxLoan[asset] = cap;
        emit MaxLoanSet(asset, cap);
    }

    function pause() external onlyOperator { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice profit sweep: always to the owner, never to an arbitrary address
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
        emit Withdrawn(token, amount);
    }

    function renounceOwnership() public pure override { revert RenounceDisabled(); }

    // no receive()/fallback: the contract cannot accept ETH
}
