import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Flame, LogOut, KeyRound } from 'lucide-react'
import { BotaoTema } from './components/ui'
import InterfaceBase from './components/Interface_base'
import Login from './components/login'
import PainelAdmin from './components/PainelAdmin'
import Onboarding from './components/Onboarding'
import RedefinirSenha from './components/RedefinirSenha'
import AlterarSenhaModal from './components/AlterarSenhaModal'
import { ROTA_REDEFINIR_SENHA } from './components/authService'
import { supabase } from './SUPABASE'

function App() {
  const [user, setUser] = useState(null)
  const [cargo, setCargo] = useState('aluno')
  const [cronograma, setCronograma] = useState(null)
  const [temCronograma, setTemCronograma] = useState(false)
  const [carregandoSessao, setCarregandoSessao] = useState(true)
  const [alterarSenhaAberto, setAlterarSenhaAberto] = useState(false)
  const navigate = useNavigate()
  // Guarda o id do usuário já processado. Evita recarregar/remontar a árvore
  // quando o Supabase re-emite eventos da MESMA sessão (foco na aba, refresh de
  // token, minimizar/restaurar) — que era o que apagava o estado da tela.
  const usuarioIdRef = useRef(undefined)

  const carregarPerfil = useCallback(async (userId) => {
    try {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('cargo')
        .eq('user_id', userId)
        .maybeSingle() // aluno recém-criado não tem linha em profiles — sem 406

      setCargo(perfil?.cargo ?? 'aluno')
    } catch (error) {
      console.error('Erro ao buscar cargo:', error)
    }
  }, [])

  const carregarCronograma = useCallback(async (userId) => {
    try {
      const { data: tabela } = await supabase
        .from('cronogramas')
        .select('dados_cronograma')
        .eq('user_id', userId)
        .maybeSingle() // primeiro acesso ainda não tem cronograma — sem 406

      if (tabela && tabela.dados_cronograma) {
        setCronograma(tabela.dados_cronograma)
        setTemCronograma(true)
      } else {
        setTemCronograma(false)
      }
    } catch {
      setTemCronograma(false)
    }
  }, [])

  // Carrega perfil + cronograma juntos e só então libera a tela — evita
  // "flashes" de redirecionamento enquanto os dados chegam.
  const carregarDadosSessao = useCallback(async (userId) => {
    setCarregandoSessao(true)
    await Promise.all([carregarPerfil(userId), carregarCronograma(userId)])
    setCarregandoSessao(false)
  }, [carregarPerfil, carregarCronograma])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, session) => {
      // Link de "esqueci minha senha" aberto: leva para a tela de nova senha,
      // mesmo que o Supabase tenha redirecionado para outra rota (ex.: a raiz,
      // quando a URL de retorno não está na allow-list do projeto).
      if (evento === 'PASSWORD_RECOVERY') navigate(ROTA_REDEFINIR_SENHA, { replace: true })

      const usuario = session?.user ?? null
      const novoId = usuario?.id ?? null

      // Só reage quando QUEM está logado muda de fato (login, logout, troca de
      // conta). Re-emissões da mesma sessão são ignoradas — assim a árvore não
      // remonta e o estado da tela (aba, matéria, filtros...) é preservado.
      if (novoId === usuarioIdRef.current) return
      usuarioIdRef.current = novoId

      setUser(usuario)

      if (usuario) {
        carregarDadosSessao(usuario.id)
      } else {
        setCarregandoSessao(false)
        setCronograma(null)
        setTemCronograma(false)
        setCargo('aluno')
      }
    })

    return () => subscription.unsubscribe()
  }, [carregarDadosSessao, navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    // O onAuthStateChange cuida de limpar o estado e os guards de rota
    // redirecionam automaticamente para /login.
  }

  // Rota inicial coerente com o estado atual do usuário.
  function rotaInicial() {
    if (!user) return '/login'
    if (cargo === 'admin') return '/admin'
    if (!temCronograma) return '/onboarding'
    return '/app'
  }

  if (carregandoSessao) {
    return (
      <div className="bg-ink-950 min-h-screen flex flex-col items-center justify-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-gold-400 text-ink-950 flex items-center justify-center shadow-[var(--shadow-gold)] animate-brilho">
          <Flame size={22} strokeWidth={2.5} />
        </span>
        <p className="text-ink-400 text-sm font-medium">Carregando seu painel...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={rotaInicial()} replace /> : <Login />}
      />

      {/* Destino do link de recuperação enviado por e-mail. Também serve para
          quem já está logado e quer trocar a senha. */}
      <Route
        path={ROTA_REDEFINIR_SENHA}
        element={<RedefinirSenha key={user?.id ?? 'anonimo'} user={user} />}
      />

      <Route
        path="/admin"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : cargo !== 'admin' ? (
            <Navigate to="/app" replace />
          ) : (
            <div className="bg-ink-950 min-h-screen relative pt-16 pb-10">
              <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                <BotaoTema className="bg-ink-900 border border-white/[0.08] rounded-xl" />
                <button
                  onClick={() => setAlterarSenhaAberto(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                             text-ink-300 bg-ink-900 border border-white/[0.08] hover:text-gold-300 hover:border-gold-400/30
                             transition-all active:scale-95"
                >
                  <KeyRound size={15} /> <span className="hidden sm:inline">Alterar senha</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                             text-ink-300 bg-ink-900 border border-white/[0.08] hover:text-rose-300 hover:border-rose-500/30
                             transition-all active:scale-95"
                >
                  <LogOut size={15} /> Sair
                </button>
              </div>
              <PainelAdmin />
              <AlterarSenhaModal
                aberto={alterarSenhaAberto}
                onFechar={() => setAlterarSenhaAberto(false)}
              />
            </div>
          )
        }
      />

      <Route
        path="/onboarding"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : cargo === 'admin' ? (
            <Navigate to="/admin" replace />
          ) : temCronograma ? (
            <Navigate to="/app" replace />
          ) : (
            <Onboarding onConcluir={() => carregarCronograma(user.id)} />
          )
        }
      />

      <Route path="/app" element={<Navigate to="/app/cronograma" replace />} />
      <Route
        path="/app/:aba"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : cargo === 'admin' ? (
            <Navigate to="/admin" replace />
          ) : !temCronograma ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <InterfaceBase
              cronograma={cronograma}
              userId={user.id}
              onLogout={handleLogout}
            />
          )
        }
      />

      <Route path="*" element={<Navigate to={rotaInicial()} replace />} />
    </Routes>
  )
}

export default App
