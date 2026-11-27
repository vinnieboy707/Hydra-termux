// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// TEST-ONLY mocks that expose the same function signatures the scanner calls on Aave, Uniswap V3 and Uniswap-V2-style venues.

contract MockERC20 {
    string public symbol; uint8 public decimals; mapping(address => uint256) public balanceOf;
    constructor(string memory s, uint8 d) { symbol = s; decimals = d; }
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function transfer(address to, uint256 a) external returns (bool) { require(balanceOf[msg.sender] >= a, 'balance'); balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
}
contract MockAave {
    struct Cfg { uint256 data; }
    struct RD {
        Cfg configuration; uint128 liquidityIndex; uint128 currentLiquidityRate; uint128 variableBorrowIndex; uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate; uint40 lastUpdateTimestamp; uint16 id; address aTokenAddress; address stableDebtTokenAddress;
        address variableDebtTokenAddress; address interestRateStrategyAddress; uint128 accruedToTreasury; uint128 unbacked; uint128 isolationModeTotalDebt;
    }
    address[] public list; mapping(address => uint256) cfg; mapping(address => address) aTok; address public provider; uint128 public FLASHLOAN_PREMIUM_TOTAL = 5;
    function add(address a, uint256 c, address at) external { list.push(a); cfg[a] = c; aTok[a] = at; }
    function setProvider(address p) external { provider = p; }
    function ADDRESSES_PROVIDER() external view returns (address) { return provider; }
    function getReservesList() external view returns (address[] memory) { return list; }
    function getConfiguration(address a) external view returns (Cfg memory) { return Cfg(cfg[a]); }
    function getReserveData(address a) external view returns (RD memory r) { r.configuration = Cfg(cfg[a]); r.aTokenAddress = aTok[a]; }
}
contract MockAP { address public o; constructor(address x) { o = x; } function getPriceOracle() external view returns (address) { return o; } }
contract MockOracle {
    mapping(address => uint256) public p; uint256 public unit = 1e8;
    function set(address a, uint256 v) external { p[a] = v; }
    function setUnit(uint256 u) external { unit = u; }
    function getAssetPrice(address a) external view returns (uint256) { return p[a]; }
    function BASE_CURRENCY_UNIT() external view returns (uint256) { return unit; }
}
contract MockV3Factory {
    mapping(bytes32 => address) pools;
    function setPool(address a, address b, uint24 f, address p) external { pools[keccak256(abi.encode(a, b, f))] = p; pools[keccak256(abi.encode(b, a, f))] = p; }
    function getPool(address a, address b, uint24 f) external view returns (address) { return pools[keccak256(abi.encode(a, b, f))]; }
    function feeAmountTickSpacing(uint24 f) external pure returns (int24) { return f == 500 ? int24(10) : f == 3000 ? int24(60) : f == 100 ? int24(1) : int24(200); }
}
contract MockV3Pool { uint128 public liquidity; constructor(uint128 l) { liquidity = l; } }
contract MockQuoter {
    struct P { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }
    address public factory; mapping(bytes32 => uint256) public rate;
    constructor(address f) { factory = f; }
    function setRate(address a, address b, uint24 fee, uint256 r) external { rate[keccak256(abi.encode(a, b, fee))] = r; }
    function quoteExactInputSingle(P memory p) external returns (uint256 amountOut, uint160 s, uint32 t, uint256 g) {
        if (p.amountIn == 8) { // a revert whose bytes look exactly like a valid quote result
            bytes memory fake = abi.encode(uint256(123456789), uint160(0), uint32(0), uint256(0));
            assembly { revert(add(fake, 32), mload(fake)) }
        }
        require(p.amountIn != 7, "this revert message is deliberately long so that its encoded bytes are longer than a real quote result");
        uint256 r = rate[keccak256(abi.encode(p.tokenIn, p.tokenOut, p.fee))]; require(r != 0, "no rate");
        return (p.amountIn * r / 1e18, 0, 0, 0);
    }
}
contract MockV2Factory {
    mapping(bytes32 => address) pairs;
    function setPair(address a, address b, address p) external { pairs[keccak256(abi.encode(a, b))] = p; pairs[keccak256(abi.encode(b, a))] = p; }
    function getPair(address a, address b) external view returns (address) { return pairs[keccak256(abi.encode(a, b))]; }
}
contract MockV2Router {
    address public factory; mapping(bytes32 => uint256) public rate;
    constructor(address f) { factory = f; }
    function setRate(address a, address b, uint256 r) external { rate[keccak256(abi.encode(a, b))] = r; }
    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amts) {
        uint256 r = rate[keccak256(abi.encode(path[0], path[1]))]; require(r != 0, "no rate");
        amts = new uint256[](2); amts[0] = amountIn; amts[1] = amountIn * r / 1e18;
    }
}

contract MockMulticall3 {
    struct Call3 { address target; bool allowFailure; bytes callData; }
    struct Result { bool success; bytes returnData; }
    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData) {
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory ret) = calls[i].target.call(calls[i].callData);
            require(ok || calls[i].allowFailure, "Multicall3: call failed");
            returnData[i] = Result(ok, ret);
        }
    }
}
contract BrokenMulticall { fallback() external payable { revert("broken"); } }
