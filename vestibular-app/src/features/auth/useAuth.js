import { createContext, useContext } from "react";

// Contexto da sessão (usuário, cargo e cronograma). O provider fica em
// AuthProvider.jsx; este arquivo existe separado por causa da regra
// react-refresh/only-export-components.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
