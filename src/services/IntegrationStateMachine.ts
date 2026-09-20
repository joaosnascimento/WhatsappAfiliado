export const WHATSAPP_STATES = ['NOT_CONFIGURED','INSTANCE_NOT_FOUND','CREATING','QR_REQUIRED','CONNECTING','CONNECTED','DISCONNECTED','LOGGED_OUT','RECONNECTING','ERROR','UNKNOWN'] as const;
export type WhatsAppConnectionState=typeof WHATSAPP_STATES[number];

export const MERCADO_LIVRE_STATES=['NOT_CONFIGURED','CONNECTING','LOGIN_REQUIRED','CONNECTED','EXPIRED','DISCONNECTED','RECONNECTING','ERROR'] as const;
export type MercadoLivreConnectionState=typeof MERCADO_LIVRE_STATES[number];

const whatsappTransitions:Record<WhatsAppConnectionState,readonly WhatsAppConnectionState[]>={
  NOT_CONFIGURED:['CREATING','CONNECTING','ERROR','UNKNOWN'],
  INSTANCE_NOT_FOUND:['CREATING','NOT_CONFIGURED','ERROR','CONNECTING','DISCONNECTED'],
  CREATING:['CONNECTING','QR_REQUIRED','ERROR','INSTANCE_NOT_FOUND'],
  QR_REQUIRED:['CONNECTING','DISCONNECTED','ERROR'],
  CONNECTING:['CONNECTED','QR_REQUIRED','DISCONNECTED','ERROR','UNKNOWN'],
  CONNECTED:['DISCONNECTED','LOGGED_OUT','RECONNECTING','ERROR','UNKNOWN'],
  DISCONNECTED:['CONNECTING','RECONNECTING','CREATING','NOT_CONFIGURED','ERROR'],
  LOGGED_OUT:['QR_REQUIRED','CREATING','NOT_CONFIGURED','ERROR'],
  RECONNECTING:['CONNECTING','CONNECTED','QR_REQUIRED','DISCONNECTED','ERROR'],
  ERROR:['RECONNECTING','CONNECTING','NOT_CONFIGURED','UNKNOWN'],
  UNKNOWN:['CREATING','CONNECTING','CONNECTED','DISCONNECTED','ERROR','NOT_CONFIGURED','INSTANCE_NOT_FOUND']
};

const mlTransitions:Record<MercadoLivreConnectionState,readonly MercadoLivreConnectionState[]>={
  NOT_CONFIGURED:['LOGIN_REQUIRED','CONNECTING'],
  CONNECTING:['CONNECTED','LOGIN_REQUIRED','ERROR','EXPIRED'],
  LOGIN_REQUIRED:['CONNECTING','CONNECTED','DISCONNECTED','ERROR'],
  CONNECTED:['EXPIRED','DISCONNECTED','RECONNECTING','ERROR'],
  EXPIRED:['CONNECTING','LOGIN_REQUIRED','RECONNECTING','DISCONNECTED'],
  DISCONNECTED:['CONNECTING','RECONNECTING','LOGIN_REQUIRED','NOT_CONFIGURED'],
  RECONNECTING:['CONNECTING','CONNECTED','LOGIN_REQUIRED','EXPIRED','ERROR'],
  ERROR:['RECONNECTING','CONNECTING','LOGIN_REQUIRED','NOT_CONFIGURED']
};

export function canTransitionWhatsApp(from:WhatsAppConnectionState,to:WhatsAppConnectionState){return from===to||whatsappTransitions[from].includes(to);}
export function canTransitionMercadoLivre(from:MercadoLivreConnectionState,to:MercadoLivreConnectionState){return from===to||mlTransitions[from].includes(to);}
export function assertWhatsAppTransition(from:WhatsAppConnectionState,to:WhatsAppConnectionState){if(!canTransitionWhatsApp(from,to))throw new Error(`Transição WhatsApp inválida: ${from} -> ${to}`);}
export function assertMercadoLivreTransition(from:MercadoLivreConnectionState,to:MercadoLivreConnectionState){if(!canTransitionMercadoLivre(from,to))throw new Error(`Transição Mercado Livre inválida: ${from} -> ${to}`);}
