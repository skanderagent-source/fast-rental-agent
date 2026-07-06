import { createContext, useContext, useState, type ReactNode } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);

  const showToast = (text: string) => {
    setMsg(text);
    setShow(true);
    setTimeout(() => setShow(false), 2800);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast ${show ? 'show' : ''}`}>{msg}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
