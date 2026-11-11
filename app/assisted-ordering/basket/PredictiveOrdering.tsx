'use client';

import { useEffect, useState } from 'react';
import s from './basket.module.css';
import { useBasket } from './useBasket';
import BasketView from './BasketView';
import Checkout from './Checkout';
import OrdersSent from './OrdersSent';

function Flow({ now }: { now: Date }) {
  const basket = useBasket(now);

  useEffect(() => {
    document.querySelector(`.${s.scroll}`)?.scrollTo({ top: 0 });
  }, [basket.step]);

  return (
    <div className={s.root}>
      {basket.step === 'basket' && <BasketView basket={basket} now={now} />}
      {basket.step === 'checkout' && <Checkout basket={basket} now={now} />}
      {basket.step === 'sent' && basket.sent && <OrdersSent summary={basket.sent} onAgain={basket.startAgain} />}
      {basket.toast && (
        <div className={s.toast} role="status" aria-live="polite">{basket.toast}</div>
      )}
    </div>
  );
}

/** Dates and cut-offs come from the clock, so render only in the browser. */
export default function PredictiveOrdering() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);
  if (!now) return <div className={s.root} />;
  return <Flow now={now} />;
}
