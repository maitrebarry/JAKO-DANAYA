export type AchatStackParamList = {
  AchatList: undefined;
  AchatCreate: undefined;
  AchatDetail: { id: number };
  AchatPaiement: { id: number; reference?: string };
  AchatReception: { id: number };
};
