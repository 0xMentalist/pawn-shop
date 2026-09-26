// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Valueless test currency for the Collector Credit Sepolia demo.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    mapping(address => uint256) public nextFaucetAt;

    event FaucetClaimed(address indexed account, uint256 amount);

    constructor() ERC20("Mock USDC", "MockUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        require(block.timestamp >= nextFaucetAt[msg.sender], "Faucet cooldown");
        nextFaucetAt[msg.sender] = block.timestamp + FAUCET_COOLDOWN;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
}
