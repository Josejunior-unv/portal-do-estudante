import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { KeyRound } from "lucide-react";
import { Modal, Botao, CampoSenha, Alerta } from "@/components/ui";
import { SENHA_MINIMA, validarNovaSenha, alterarSenha } from "@/features/auth/authService";

// Formulário em modal para o usuário logado trocar a própria senha. Fica num
// componente separado do Modal para o estado zerar a cada abertura.
function FormularioAlterarSenha({ onFechar }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const invalida = validarNovaSenha(nova, confirmacao);
    if (invalida) {
      setErro(invalida);
      return;
    }
    setCarregando(true);
    try {
      await alterarSenha(atual, nova);
      setConcluido(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="p-6 sm:p-8">
      <span className="mb-5 w-11 h-11 rounded-2xl bg-gold-400/10 border border-gold-400/20 text-gold-400 flex items-center justify-center">
        <KeyRound size={20} />
      </span>
      <h2 className="font-display text-xl font-black text-white tracking-tight">Alterar senha</h2>

      {concluido ? (
        <>
          <Alerta variante="sucesso" className="mt-5">
            Senha alterada com sucesso. Use a nova senha no próximo login.
          </Alerta>
          <Botao className="w-full mt-5" onClick={onFechar}>
            Fechar
          </Botao>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-400 mt-1 mb-6">
            Confirme a senha atual e escolha uma nova.
          </p>

          <AnimatePresence mode="popLayout">
            {erro && (
              <Alerta key="erro" variante="erro" className="mb-4">
                {erro}
              </Alerta>
            )}
          </AnimatePresence>

          <form onSubmit={salvar} className="space-y-4">
            <CampoSenha
              rotulo="Senha atual"
              required
              autoFocus
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              autoComplete="current-password"
            />
            <CampoSenha
              rotulo="Nova senha"
              required
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`}
              autoComplete="new-password"
            />
            <CampoSenha
              rotulo="Confirmar nova senha"
              required
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
            />
            <div className="flex gap-2 pt-2">
              <Botao variante="secundario" className="flex-1" onClick={onFechar}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={carregando} className="flex-1">
                {carregando ? "Salvando..." : "Salvar"}
              </Botao>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function AlterarSenhaModal({ aberto, onFechar }) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} className="max-w-md">
      {aberto && <FormularioAlterarSenha onFechar={onFechar} />}
    </Modal>
  );
}

export default AlterarSenhaModal;
