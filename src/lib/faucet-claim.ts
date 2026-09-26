import { keccak256, toBytes } from "viem";
import { FAUCET_CARDS } from "./faucet-cards";

export function getFaucetCard(cardId: string) {
  return FAUCET_CARDS.find((card) => card.id === cardId);
}

export function createFaucetCardInput(card: (typeof FAUCET_CARDS)[number], expiresAt: bigint) {
  const number = Number(card.id.slice("faucet-base-".length));
  const metadata = {
    name: `${card.year} ${card.name} · ${card.setName} · PSA ${card.grade}`,
    description: "Pawn Shop simulated demo card. No physical card is held or represented by this NFT. The displayed value is a PSA price guide estimate, not a sale of this token.",
    image: card.imageUrl,
    external_url: card.saleSourceUrl,
    attributes: [
      { trait_type: "Set", value: card.setName },
      { trait_type: "Card number", value: `${number}/102` },
      { trait_type: "Demo grade", value: `PSA ${card.grade}` },
      { trait_type: "Demo certificate", value: card.certificationNumber },
    ],
  };
  return {
    number,
    cardName: card.name,
    setName: card.setName,
    year: card.year,
    grader: card.grader,
    grade: card.grade,
    certificationNumber: card.certificationNumber,
    imageUri: card.imageUrl,
    metadataUri: `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`,
    custodyAttestationHash: keccak256(toBytes(`simulated-demo-custody:${card.certificationNumber}`)),
    expiresAt,
  };
}
