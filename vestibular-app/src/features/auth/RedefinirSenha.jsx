import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, CheckCircle2, ArrowLeft } from "lucide-react";
import { Botao, CampoTexto, CampoSenha, Alerta, BotaoTema } from "@/components/ui";
import {
  SENHA_MINIMA,
  validarNovaSenha,
  definirNovaSenha,
  solicitarRecuperacaoSenha,
  erroDoLinkDeRecuperacao,
} from "@/features/auth/authService";

// Destino do link "Redefinir senha" enviado por e-mail. O Supabase abre uma
// sessão de recuperação ao carregar a página (o App repassa o usuário):
//  - com sessão  → formulário de nova senha;
//  - sem sessão  → link inválido/expirado: oferece pedir um novo.
function RedefinirSenha({ user }) {
  const navigate = useNavigate();

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState(() => (user ? "" : erroDoLinkDeRecuperacao() ?? ""));
  const [sucesso, setSucesso] = useState("");
  const [concluido, setConcluido] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function salvarSenha(e) {
    e.preventDefault();
    setErro("");
    const invalida = validarNovaSenha(senha, confirmacao);
    if (invalida) {
      setErro(invalida);
      return;
    }
    setCarregando(true);
    try {
      await definirNovaSenha(senha);
      setConcluido(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function pedirNovoLink(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setCarregando(true);
    try {
      await solicitarRecuperacaoSenha(email);
      setSucesso("Se existir uma conta com esse e-mail, você vai receber um novo link em instantes.");
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-ink-950 flex items-center justify-center px-4 py-10">
      <BotaoTema className="absolute top-4 right-4" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <span className="mb-6 w-12 h-12 rounded-2xl bg-gold-400 text-sobre-destaque flex items-center justify-center shadow-[var(--shadow-gold)]">
          {concluido ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <KeyRound size={22} strokeWidth={2.5} />}
        </span>

        {concluido ? (
          <>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">Senha alterada!</h1>
            <p className="text-sm text-ink-400 mt-1.5 mb-7">
              Sua nova senha já está valendo. Use-a no próximo login.
            </p>
            <Botao tamanho="lg" className="w-full" onClick={() => navigate("/", { replace: true })}>
              Continuar estudando
            </Botao>
          </>
        ) : user ? (
          <>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">Crie uma nova senha</h1>
            <p className="text-sm text-ink-400 mt-1.5 mb-7">
              Conta <span className="text-ink-200 font-semibold">{user.email}</span>
            </p>

            <AnimatePresence mode="popLayout">
              {erro && (
                <Alerta key="erro" variante="erro" className="mb-4">
                  {erro}
                </Alerta>
              )}
            </AnimatePresence>

            <form onSubmit={salvarSenha} className="space-y-4">
              <CampoSenha
                rotulo="Nova senha"
                required
                autoFocus
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`}
                autoComplete="new-password"
              />
              <CampoSenha
                rotulo="Confirmar nova senha"
                required
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
              <Botao type="submit" disabled={carregando} tamanho="lg" className="w-full mt-2">
                {carregando ? "Salvando..." : "Salvar nova senha"}
              </Botao>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">Link inválido</h1>
            <p className="text-sm text-ink-400 mt-1.5 mb-7">
              Não encontramos uma recuperação de senha ativa. Informe seu e-mail para receber um novo link.
            </p>

            <AnimatePresence mode="popLayout">
              {erro && (
                <Alerta key="erro" variante="erro" className="mb-4">
                  {erro}
                </Alerta>
              )}
              {sucesso && (
                <Alerta key="sucesso" variante="sucesso" className="mb-4">
                  {sucesso}
                </Alerta>
              )}
            </AnimatePresence>

            <form onSubmit={pedirNovoLink} className="space-y-4">
              <CampoTexto
                rotulo="E-mail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                autoComplete="email"
              />
              <Botao type="submit" disabled={carregando} tamanho="lg" className="w-full">
                {carregando ? "Enviando..." : "Enviar novo link"}
              </Botao>
            </form>

            <Botao variante="fantasma" className="w-full mt-4" onClick={() => navigate("/login", { replace: true })}>
              <ArrowLeft size={15} /> Voltar para o login
            </Botao>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default RedefinirSenha;
