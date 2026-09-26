import type { Address } from "viem";
import deployment from "../../deployments/ens-sepolia.json";
import protocolDeployment from "../../deployments/ens-protocol-sepolia.json";

export const ENS_ROOT_NAME = process.env.NEXT_PUBLIC_ENS_ROOT_NAME ?? deployment.name;
export const ENS_REGISTRY_ADDRESS = "0x657ea849311d3d5823348dded7c2aaafb3ede09e" as Address;
export const ENS_RESOLVER_ADDRESS = deployment.resolver as Address;
export const ENS_OWNER_ADDRESS = deployment.owner as Address;
export const ENS_SUBREGISTRY_ADDRESS = deployment.subregistry as Address;
export const ENS_REGISTRATION_TX = deployment.transactions.register;
export const ENS_TEXT_ROLE_KEY = "com.collectorcredit.role";
export const ENS_TEXT_ROLE_VALUE = "borrower";
export const ENS_SEPOLIA_CHAIN_ID = 11155111;

export const PROTOCOL_ENS_NAME = protocolDeployment.name;
export const PROTOCOL_ENS_OWNER = protocolDeployment.owner as Address;
export const PROTOCOL_ENS_RESOLVER = protocolDeployment.resolver as Address;
export const PROTOCOL_ENS_SUBREGISTRY = protocolDeployment.subregistry as Address;
export const PROTOCOL_ENS_APPRAISER_RESOLVER = protocolDeployment.appraiserResolver as Address;
export const PROTOCOL_ENS_APPRAISER_ADDRESS = protocolDeployment.appraiser as Address;
export const PROTOCOL_ENS_REGISTRATION_TX = protocolDeployment.transactions.register;
export const PROTOCOL_ENS_APPRAISER_NOTE_KEY = "com.altrwalend.appraiser.note";
