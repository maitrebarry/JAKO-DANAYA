export type AchatStackParamList = {
  AchatList: undefined;
  AchatCreate: undefined;
  AchatDetail: { id: number };
  AchatPaiement: { id: number; reference?: string; total?: number; montantPaye?: number };
  AchatReception: { id: number };
};
