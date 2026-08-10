export const BOOKING_STATES=['draft','slot-held','requested','confirmed','in-progress','awaiting-final-settlement','completed','unfilled','cancelled','safety-stopped'];
export const PAYMENT_STATES=['none','payment-required','pending','prepaid','paid','cash-selected','cash-due','cash-collected','membership-entitled','additional-payment-due','refund-pending','refunded','review','failed'];

export function initialBookingState({supportType,paymentMethod}){
  if(paymentMethod==='cash')return{bookingStatus:'requested',paymentStatus:'cash-selected',paymentRequired:false};
  if(paymentMethod==='membership')return{bookingStatus:'requested',paymentStatus:'membership-entitled',paymentRequired:false};
  return{bookingStatus:'slot-held',paymentStatus:'payment-required',paymentRequired:true};
}

export function validPaymentMethod(supportType,method){
  return supportType==='Home visit'?['online','cash'].includes(method):['online','membership'].includes(method);
}

