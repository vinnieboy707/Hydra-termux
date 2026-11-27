// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IAavePool {
    function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external;
}

interface IBalancerVault {
    function flashLoan(address recipient, address[] calldata tokens, uint256[] calldata amounts, bytes calldata userData) external;
}

/// Morpho Blue (docs.morpho.org/learn/concepts/flashloans): no fee; Morpho sends `assets`, calls onMorphoFlashLoan on the
/// caller, then pulls `assets` back with transferFrom, so the callback approves Morpho for that amount.
interface IMorpho {
    function flashLoan(address token, uint256 assets, bytes calldata data) external;
}

/// Uniswap V4 PoolManager (v4-core IPoolManager): `take` inside `unlock` is a free flash loan; repaid by
/// sync(currency) → transfer → settle() before the unlock callback returns.
interface IPoolManager {
    function unlock(bytes calldata data) external returns (bytes memory);
    function take(address currency, address to, uint256 amount) external;
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
}

/// Curve stable pools (StableSwap NG and plain pools): coins by index.
interface ICurvePool {
    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external returns (uint256);
    function coins(uint256 i) external view returns (address);
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
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts);
}

interface IV3Pool {
    function factory() external view returns (address);
    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data)
        external
        returns (int256 amount0, int256 amount1);
}

interface IV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

/// Concentrated-liquidity factories keyed by tick spacing (Velodrome-Slipstream-style CL, Solidly V3).
interface IV3FactoryTS {
    function getPool(address tokenA, address tokenB, int24 tickSpacing) external view returns (address);
}

/// Algebra factories (one pool per pair).
interface IAlgebraFactory {
    function poolByPair(address tokenA, address tokenB) external view returns (address);
}

interface IV2Pair {
    function factory() external view returns (address);
    function token0() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

/// @title ChronosFlashArbV2
/// @notice Flash-loan arbitrage executor: borrows from Aave V3, Balancer V2, Morpho Blue or Uniswap V4, swaps through up to 5 legs (routers or
///         pools called directly), and reverts unless the trade is net-profitable. Built on ChronosFlashArb (v1) with
///         every v1 protection kept: operators only, per-asset loan caps, allowlisted routers, a minimum profit,
///         pause, owner-only withdraw to the owner, renounce disabled, no ETH accepted.
/// @dev New in v2:
///      - Balancer V2 flash loans. Balancer does not tell the receiver who started a loan, so this contract records a
///        one-time hash of the loan it starts and accepts the callback only for that exact loan.
///      - Direct pool swaps (Uniswap-V3-style pools and V2 pairs). A pool is accepted only if its factory is
///        allowlisted by the owner AND that factory reports this exact pool for the token pair (and fee). A swap
///        callback is accepted only from the pool being swapped at that moment, and pays at most the amount in.
///      - v2.1: Uniswap-V3-style forks that differ only in how their factory names a pool and in the callback name:
///        factories keyed by fee (Uniswap, Sushi, Pancake, Ramses V2), by tick spacing (CL / Solidly V3; the leg's
///        `fee` field carries the tick spacing) or one pool per pair (Algebra). The owner sets each factory's lookup;
///        the same checks apply to all of them: allowlisted factory, the factory confirms this exact pool, and only
///        the pool being swapped may be paid, at most the amount in.
///      - v2.3: Uniswap V4 flash accounting (no fee; repaid with sync → transfer → settle inside the unlock callback)
///        and Curve stable pools (owner-allowlisted pools; the leg's `fee` field carries the coin indexes i << 8 | j and
///        the contract checks the pool really holds tokenIn at i and tokenOut at j).
///      - v2.2: Morpho Blue flash loans (no fee; the lender a profitable Arbitrum competitor uses), with the same
///        one-time loan hash as Balancer because Morpho's callback does not name the initiator; up to 5 legs.
contract ChronosFlashArbV2 is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum Dex { UniV3Router, UniV2Router, V3Pool, V2Pair, CurvePool }
    enum Source { AaveV3, BalancerV2, MorphoBlue, UniswapV4 }

    struct Leg {
        Dex dex;
        address target;   // router (allowlisted) or pool / pair (verified against an allowlisted factory)
        address tokenOut; // tokenIn is the previous leg's tokenOut (leg 0: the borrowed asset)
        uint24 fee;       // V3 fee tier · tick spacing (lookup mode 1) · Curve coin indexes (i << 8 | j); ignored for V2
        uint256 minOut;   // per-leg slippage floor
    }

    uint8 public constant MAX_LEGS = 5;
    uint160 internal constant MIN_SQRT_RATIO_PLUS_1 = 4295128740;
    uint160 internal constant MAX_SQRT_RATIO_MINUS_1 = 1461446703485210103287273052203988822378723970341;

    IAavePool public immutable POOL;
    IBalancerVault public immutable VAULT; // zero: Balancer loans disabled
    IMorpho public immutable MORPHO;       // zero: Morpho loans disabled
    IPoolManager public immutable V4;      // zero: Uniswap V4 loans disabled

    mapping(address => bool) public operators;
    mapping(address => bool) public allowedRouters;
    mapping(address => uint256) public maxLoan;       // 0 = asset not allowed
    mapping(address => bool) public allowedFactories; // V3 factories and V2 factories
    mapping(address => uint16) public v2FeeBps;       // swap fee of a V2 factory's pairs (e.g. 30 = 0.30 %); 0 for V3
    mapping(address => bool) public allowedCurvePools; // Curve pools the owner allowed
    mapping(address => uint8) public v3Lookup;        // V3 factories: 0 getPool(a,b,fee) · 1 getPool(a,b,tickSpacing) · 2 poolByPair(a,b)

    bytes32 private _pendingBalancerLoan; // set by execute(), consumed by receiveFlashLoan()
    bytes32 private _pendingMorphoLoan;   // set by execute(), consumed by onMorphoFlashLoan()
    bytes32 private _pendingV4Loan;       // set by execute(), consumed by unlockCallback()
    address private _activePool;          // the pool whose swap callback is expected right now
    uint256 private _activeMaxIn;         // the most that pool may ask for

    event Arbitrage(address indexed asset, uint256 amount, uint256 premium, uint256 profit);
    event ArbitrageV2(Source indexed source, address indexed asset, uint256 amount, uint256 fee, uint256 profit);
    event OperatorSet(address indexed operator, bool allowed);
    event RouterSet(address indexed router, bool allowed);
    event FactorySet(address indexed factory, bool allowed, uint16 v2FeeBps);
    event MaxLoanSet(address indexed asset, uint256 cap);
    event V3LookupSet(address indexed factory, uint8 mode);
    event CurvePoolSet(address indexed pool, bool allowed);
    event Withdrawn(address indexed token, uint256 amount);

    error NotOperator();
    error BadCaller();
    error Expired();
    error LoanNotAllowed();
    error BadLegs();
    error RouterNotAllowed();
    error PoolNotAllowed();
    error BadSource();
    error BadCallback();
    error ZeroMinProfit();
    error Slippage();
    error Unprofitable(uint256 endBalance, uint256 required);
    error ZeroAddress();
    error RenounceDisabled();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(address aavePool, address balancerVault, address morpho, address v4PoolManager) Ownable(msg.sender) {
        if (aavePool == address(0)) revert ZeroAddress();
        POOL = IAavePool(aavePool);
        VAULT = IBalancerVault(balancerVault);
        MORPHO = IMorpho(morpho);
        V4 = IPoolManager(v4PoolManager);
    }

    // ---------------------------------------------------------------- trading

    /// @return profit net profit in `asset` units, after the flash-loan fee
    function execute(Source source, address asset, uint256 amount, uint256 minProfit, uint256 deadline, Leg[] calldata legs)
        external
        onlyOperator
        nonReentrant
        whenNotPaused
        returns (uint256 profit)
    {
        if (block.timestamp > deadline) revert Expired();
        if (minProfit == 0) revert ZeroMinProfit();
        uint256 cap = maxLoan[asset];
        if (cap == 0 || amount == 0 || amount > cap) revert LoanNotAllowed();

        uint256 n = legs.length;
        if (n < 2 || n > MAX_LEGS) revert BadLegs();
        address prev = asset;
        for (uint256 i; i < n; ++i) {
            Leg calldata l = legs[i];
            if (l.target == address(0) || l.tokenOut == address(0) || l.tokenOut == prev) revert BadLegs();
            if ((l.dex == Dex.UniV3Router || l.dex == Dex.UniV2Router) && !allowedRouters[l.target]) revert RouterNotAllowed();
            if (l.dex == Dex.CurvePool && !allowedCurvePools[l.target]) revert PoolNotAllowed();
            prev = l.tokenOut;
        }
        if (prev != asset) revert BadLegs(); // must end in the borrowed asset

        bytes memory params = abi.encode(minProfit, deadline, legs);
        uint256 balBefore = IERC20(asset).balanceOf(address(this));
        if (source == Source.AaveV3) {
            POOL.flashLoanSimple(address(this), asset, amount, params, 0);
        } else if (source == Source.UniswapV4) {
            if (address(V4) == address(0)) revert BadSource();
            bytes memory data = abi.encode(asset, amount, params);
            _pendingV4Loan = keccak256(data);
            V4.unlock(data);
            if (_pendingV4Loan != bytes32(0)) revert BadCallback(); // the PoolManager never called back
        } else if (source == Source.MorphoBlue) {
            if (address(MORPHO) == address(0)) revert BadSource();
            bytes memory data = abi.encode(asset, params); // Morpho's callback passes only the amount and this data
            _pendingMorphoLoan = keccak256(abi.encode(amount, data));
            MORPHO.flashLoan(asset, amount, data);
            if (_pendingMorphoLoan != bytes32(0)) revert BadCallback(); // Morpho never called back
        } else {
            if (address(VAULT) == address(0)) revert BadSource();
            address[] memory tokens = new address[](1);
            uint256[] memory amounts = new uint256[](1);
            tokens[0] = asset;
            amounts[0] = amount;
            _pendingBalancerLoan = keccak256(abi.encode(asset, amount, params));
            VAULT.flashLoan(address(this), tokens, amounts, params);
            if (_pendingBalancerLoan != bytes32(0)) revert BadCallback(); // the vault never called back
        }
        profit = IERC20(asset).balanceOf(address(this)) - balBefore;
    }

    /// @dev Aave V3 callback.
    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params)
        external
        returns (bool)
    {
        if (msg.sender != address(POOL) || initiator != address(this) || !_reentrancyGuardEntered()) revert BadCaller();
        _run(Source.AaveV3, asset, amount, premium, params);
        IERC20(asset).forceApprove(address(POOL), amount + premium); // the pool pulls this after return
        return true;
    }

    /// @dev Balancer V2 callback: only for the one loan execute() started (Balancer does not pass the initiator).
    function receiveFlashLoan(address[] calldata tokens, uint256[] calldata amounts, uint256[] calldata feeAmounts, bytes calldata userData)
        external
    {
        if (msg.sender != address(VAULT) || address(VAULT) == address(0) || !_reentrancyGuardEntered()) revert BadCaller();
        if (tokens.length != 1 || amounts.length != 1 || feeAmounts.length != 1) revert BadCaller();
        bytes32 h = keccak256(abi.encode(tokens[0], amounts[0], userData));
        if (_pendingBalancerLoan == bytes32(0) || h != _pendingBalancerLoan) revert BadCaller();
        _pendingBalancerLoan = bytes32(0);
        _run(Source.BalancerV2, tokens[0], amounts[0], feeAmounts[0], userData);
        IERC20(tokens[0]).safeTransfer(address(VAULT), amounts[0] + feeAmounts[0]); // Balancer is repaid by transfer
    }

    /// @dev Morpho Blue callback: only for the one loan execute() started. No fee; Morpho pulls `assets` back after return.
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        if (msg.sender != address(MORPHO) || address(MORPHO) == address(0) || !_reentrancyGuardEntered()) revert BadCaller();
        if (_pendingMorphoLoan == bytes32(0) || keccak256(abi.encode(assets, data)) != _pendingMorphoLoan) revert BadCaller();
        _pendingMorphoLoan = bytes32(0);
        (address asset, bytes memory params) = abi.decode(data, (address, bytes));
        _run(Source.MorphoBlue, asset, assets, 0, params);
        IERC20(asset).forceApprove(address(MORPHO), assets);
    }

    /// @dev Uniswap V4 unlock callback: only for the one loan execute() started. Borrow with take, trade, then repay
    ///      exactly the amount (no fee): sync before the transfer, settle after it, so every delta is zero at the end.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(V4) || address(V4) == address(0) || !_reentrancyGuardEntered()) revert BadCaller();
        if (_pendingV4Loan == bytes32(0) || keccak256(data) != _pendingV4Loan) revert BadCaller();
        _pendingV4Loan = bytes32(0);
        (address asset, uint256 amount, bytes memory params) = abi.decode(data, (address, uint256, bytes));
        V4.take(asset, address(this), amount);
        _run(Source.UniswapV4, asset, amount, 0, params);
        V4.sync(asset);
        IERC20(asset).safeTransfer(address(V4), amount);
        V4.settle();
        return "";
    }

    function _run(Source source, address asset, uint256 amount, uint256 fee, bytes memory params) internal {
        this.runLegs(source, asset, amount, fee, params);
    }

    /// @dev The trade loop, shared by every lender's callback. Callable only by this contract, from inside a loan it
    ///      started (one copy of this code instead of one per lender keeps the contract under the 24,576-byte limit).
    function runLegs(Source source, address asset, uint256 amount, uint256 fee, bytes calldata params) external {
        if (msg.sender != address(this) || !_reentrancyGuardEntered()) revert BadCaller();
        (uint256 minProfit, uint256 deadline, Leg[] memory legs) = abi.decode(params, (uint256, uint256, Leg[]));
        uint256 startBal = IERC20(asset).balanceOf(address(this)); // includes the loan
        address tokenIn = asset;
        uint256 amountIn = amount;
        for (uint256 i; i < legs.length; ++i) {
            amountIn = _swap(legs[i], tokenIn, amountIn, deadline);
            tokenIn = legs[i].tokenOut;
        }
        uint256 endBal = IERC20(asset).balanceOf(address(this));
        uint256 required = startBal + fee + minProfit;
        if (endBal < required) revert Unprofitable(endBal, required);
        uint256 profit = endBal - startBal - fee;
        emit Arbitrage(asset, amount, fee, profit); // same event as v1: the engine's profit records keep working
        emit ArbitrageV2(source, asset, amount, fee, profit);
    }

    function _swap(Leg memory leg, address tokenIn, uint256 amountIn, uint256 deadline) internal returns (uint256 received) {
        IERC20 out = IERC20(leg.tokenOut);
        uint256 balBefore = out.balanceOf(address(this));

        if (leg.dex == Dex.UniV3Router) {
            if (!allowedRouters[leg.target]) revert RouterNotAllowed();
            IERC20(tokenIn).forceApprove(leg.target, amountIn);
            IUniswapV3Router(leg.target).exactInputSingle(
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
            IERC20(tokenIn).forceApprove(leg.target, 0);
        } else if (leg.dex == Dex.UniV2Router) {
            if (!allowedRouters[leg.target]) revert RouterNotAllowed();
            IERC20(tokenIn).forceApprove(leg.target, amountIn);
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = leg.tokenOut;
            IUniswapV2Router(leg.target).swapExactTokensForTokens(amountIn, leg.minOut, path, address(this), deadline);
            IERC20(tokenIn).forceApprove(leg.target, 0);
        } else if (leg.dex == Dex.V3Pool) {
            _checkV3Pool(leg.target, tokenIn, leg.tokenOut, leg.fee);
            if (amountIn > uint256(type(int256).max)) revert BadLegs();
            bool zeroForOne = tokenIn < leg.tokenOut;
            _activePool = leg.target;
            _activeMaxIn = amountIn;
            IV3Pool(leg.target).swap(
                address(this), zeroForOne, int256(amountIn), zeroForOne ? MIN_SQRT_RATIO_PLUS_1 : MAX_SQRT_RATIO_MINUS_1, abi.encode(tokenIn)
            );
            if (_activePool != address(0)) revert BadCallback(); // the pool never asked to be paid
        } else if (leg.dex == Dex.CurvePool) {
            if (!allowedCurvePools[leg.target]) revert PoolNotAllowed();
            uint256 i = uint256(leg.fee >> 8);
            uint256 j = uint256(leg.fee & 0xff);
            if (i == j || ICurvePool(leg.target).coins(i) != tokenIn || ICurvePool(leg.target).coins(j) != leg.tokenOut) revert PoolNotAllowed();
            IERC20(tokenIn).forceApprove(leg.target, amountIn);
            ICurvePool(leg.target).exchange(int128(int256(i)), int128(int256(j)), amountIn, leg.minOut);
            IERC20(tokenIn).forceApprove(leg.target, 0);
        } else {
            uint16 feeBps = _checkV2Pair(leg.target, tokenIn, leg.tokenOut);
            (uint112 r0, uint112 r1,) = IV2Pair(leg.target).getReserves();
            bool inIs0 = IV2Pair(leg.target).token0() == tokenIn;
            (uint256 rIn, uint256 rOut) = inIs0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
            uint256 inWithFee = amountIn * (10_000 - feeBps);
            uint256 amountOut = (inWithFee * rOut) / (rIn * 10_000 + inWithFee);
            IERC20(tokenIn).safeTransfer(leg.target, amountIn);
            IV2Pair(leg.target).swap(inIs0 ? 0 : amountOut, inIs0 ? amountOut : 0, address(this), new bytes(0));
        }

        received = out.balanceOf(address(this)) - balBefore; // measured, never trusted from the venue
        if (received < leg.minOut) revert Slippage();
    }

    function _checkV3Pool(address pool, address a, address b, uint24 fee) internal view {
        address f = IV3Pool(pool).factory();
        if (!allowedFactories[f] || v2FeeBps[f] != 0) revert PoolNotAllowed();
        uint8 mode = v3Lookup[f];
        address expected = mode == 0
            ? IV3Factory(f).getPool(a, b, fee)
            : mode == 1
                ? IV3FactoryTS(f).getPool(a, b, int24(fee)) // the leg's fee field carries the tick spacing
                : IAlgebraFactory(f).poolByPair(a, b);
        if (expected != pool) revert PoolNotAllowed();
    }

    function _checkV2Pair(address pair, address a, address b) internal view returns (uint16 feeBps) {
        address f = IV2Pair(pair).factory();
        feeBps = v2FeeBps[f];
        if (!allowedFactories[f] || feeBps == 0 || feeBps >= 10_000) revert PoolNotAllowed();
        if (IV2Factory(f).getPair(a, b) != pair) revert PoolNotAllowed();
    }

    /// @dev Uniswap V3 / Sushi V3 swap callback.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _payPool(amount0Delta, amount1Delta, data);
    }

    /// @dev PancakeSwap V3 swap callback.
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _payPool(amount0Delta, amount1Delta, data);
    }

    /// @dev Ramses V2 swap callback.
    function ramsesV2SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _payPool(amount0Delta, amount1Delta, data);
    }

    /// @dev Solidly V3 swap callback.
    function solidlyV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _payPool(amount0Delta, amount1Delta, data);
    }

    /// @dev Algebra swap callback.
    function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _payPool(amount0Delta, amount1Delta, data);
    }

    function _payPool(int256 amount0Delta, int256 amount1Delta, bytes calldata data) internal {
        if (_activePool == address(0) || msg.sender != _activePool) revert BadCallback();
        uint256 pay = amount0Delta > 0 ? uint256(amount0Delta) : amount1Delta > 0 ? uint256(amount1Delta) : 0;
        if (pay == 0 || pay > _activeMaxIn) revert BadCallback();
        _activePool = address(0); // one payment per swap
        _activeMaxIn = 0;
        IERC20(abi.decode(data, (address))).safeTransfer(msg.sender, pay);
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

    /// @notice allow a pool factory. feeBps: the swap fee of a V2 factory's pairs (1–9999); 0 for a V3 factory.
    function setFactory(address factory, bool allowed, uint16 feeBps) external onlyOwner {
        if (factory == address(0) || feeBps >= 10_000) revert ZeroAddress();
        allowedFactories[factory] = allowed;
        v2FeeBps[factory] = allowed ? feeBps : 0;
        emit FactorySet(factory, allowed, feeBps);
    }

    /// @notice how a V3 factory names its pools: 0 by fee, 1 by tick spacing, 2 one pool per pair (Algebra)
    function setV3Lookup(address factory, uint8 mode) external onlyOwner {
        if (factory == address(0) || mode > 2) revert ZeroAddress();
        v3Lookup[factory] = mode;
        emit V3LookupSet(factory, mode);
    }

    /// @notice allow a Curve pool (StableSwap NG / plain pool)
    function setCurvePool(address pool, bool allowed) external onlyOwner {
        if (pool == address(0)) revert ZeroAddress();
        allowedCurvePools[pool] = allowed;
        emit CurvePoolSet(pool, allowed);
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
