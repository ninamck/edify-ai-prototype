/**
 * Lines added to the basket from Command Centre ("add 2 bags of chicken
 * to the Bidvest order"). The basket page starts from these, so what was
 * said shows up when someone opens the basket to send it.
 */
export interface ChatBasketLine {
  supplierId: string;
  productId: string;
  packs: number;
}

let lines: ChatBasketLine[] = [];

export function addChatBasketLine(line: ChatBasketLine) {
  lines = [...lines.filter((l) => !(l.supplierId === line.supplierId && l.productId === line.productId)), line];
}

export function removeChatBasketLine(supplierId: string, productId: string) {
  lines = lines.filter((l) => !(l.supplierId === supplierId && l.productId === productId));
}

export function chatBasketLines(): ChatBasketLine[] {
  return lines;
}
