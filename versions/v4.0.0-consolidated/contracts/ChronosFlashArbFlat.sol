// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroToOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

contract ChronosFlashArb {
    address public immutable owner;

    modifier onlyAuthorized() {
        require(msg.sender == owner, "UNAUTHORIZED_POLICY_VIOLATION");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function executeArbitrage(
        address poolA,
        address poolB,
        bool zeroToOneA,
        int256 amount,
        uint160 priceLimit
    ) external onlyAuthorized {
        bytes memory callbackData = abi.encode(poolA, poolB, zeroToOneA);
        
        IUniswapV3Pool(poolA).swap(
            msg.sender,
            zeroToOneA,
            amount,
            priceLimit,
            callbackData
        );
    }
}
