import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, GraduationCap, BookOpenCheck, TrendingUp, ArrowLeft } from 'lucide-react'
import { supabase } from '../SUPABASE'
import { Botao, CampoTexto, CampoSenha, Alerta, BotaoTema } from './ui'
import { SENHA_MINIMA, traduzErroAuth as traduzErro, solicitarRecuperacaoSenha } from './authService'

const PILARES = [
  { icone: BookOpenCheck, titulo: 'Provas e materiais', texto: 'Biblioteca completa das provas da UERJ, organizada por ano e matéria.' },
  { icone: GraduationCap, titulo: 'Questões e simulados', texto: 'Banco oficial do ENEM com correção instantânea e ranking.' },
  { icone: TrendingUp, titulo: 'Evolução visível', texto: 'Estatísticas automáticas do seu desempenho em cada matéria.' },
]

function Login() {
  // modo: 'login' | 'cadastro' | 'recuperar'
  const [modo, setModo] = useState('login')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const limparMensagens = () => {
    setErro('')
    setSucesso('')
  }

  function trocarModo(novo) {
    setModo(novo)
    limparMensagens()
    setSenha('')
    setConfirmarSenha('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    limparMensagens()
    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    setCarregando(false)

    if (error) setErro(traduzErro(error.message))
    // Em caso de sucesso, o redirecionamento é feito automaticamente pelo
    // listener onAuthStateChange no App.jsx.
  }

  async function handleCadastro(e) {
    e.preventDefault()
    limparMensagens()

    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)

    // Cadastro SEMPRE como aluno: não gravamos nenhum cargo aqui. O App assume
    // 'aluno' por padrão quando não há registro em `profiles`. Contas de
    // administrador são criadas manualmente (cargo='admin' na tabela profiles).
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: { nome: nome.trim() },
        emailRedirectTo: window.location.origin,
      },
    })

    setCarregando(false)

    if (error) {
      setErro(traduzErro(error.message))
      return
    }

    if (data?.session) {
      // Confirmação de e-mail desativada: já entra direto (o listener redireciona).
      setSucesso('Conta criada com sucesso! Entrando...')
    } else {
      // Confirmação de e-mail ativada: precisa confirmar antes de entrar.
      setSucesso('Conta criada! Enviamos um e-mail de confirmação — confirme para entrar.')
      setModo('login')
      setSenha('')
      setConfirmarSenha('')
    }
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    limparMensagens()
    setCarregando(true)
    try {
      await solicitarRecuperacaoSenha(email)
      // Mensagem neutra de propósito: não revela se o e-mail tem conta.
      setSucesso(
        'Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.',
      )
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const ehCadastro = modo === 'cadastro'
  const ehRecuperar = modo === 'recuperar'

  const TEXTOS = {
    login: { titulo: 'Bem-vindo de volta', sub: 'Entre para continuar seus estudos.' },
    cadastro: { titulo: 'Criar sua conta', sub: 'Leva menos de um minuto — e o estudo começa hoje.' },
    recuperar: {
      titulo: 'Recuperar senha',
      sub: 'Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.',
    },
  }

  const onSubmit = ehRecuperar ? handleRecuperar : ehCadastro ? handleCadastro : handleLogin
  const textoBotao = carregando
    ? ehRecuperar
      ? 'Enviando...'
      : ehCadastro
        ? 'Criando conta...'
        : 'Entrando...'
    : ehRecuperar
      ? 'Enviar link de recuperação'
      : ehCadastro
        ? 'Criar minha conta'
        : 'Entrar'

  return (
    <div className="min-h-screen bg-ink-950 lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ===== PAINEL DA MARCA ===== */}
      <div className="tema-escuro-fixo relative hidden lg:flex flex-col justify-between overflow-hidden bg-black p-12">
        {/* brilho dourado ambiente */}
        <div
          aria-hidden
          className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C042 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-52 -right-32 w-[480px] h-[480px] rounded-full opacity-[0.05] blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C042 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex items-center gap-2 text-gold-400">
          <Flame size={20} strokeWidth={2.5} />
          <span className="font-display font-bold tracking-wide text-sm text-ink-200 uppercase">
            Pré-Vestibular UERJ Para Todos
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 max-w-lg"
        >
          <img
            src="/logo-uerj.jpeg"
            alt="Pré-Vestibular UERJ Para Todos"
            className="w-64 mb-10 select-none pointer-events-none"
            draggable={false}
          />
          <h1 className="font-display text-4xl font-black text-white leading-[1.1] tracking-tight">
            Sua aprovação começa
            <br />
            com um bom plano.
          </h1>
          <p className="text-ink-300 mt-4 leading-7">
            Cronograma personalizado, provas anteriores, simulados e estatísticas
            — tudo em um só lugar, feito para quem vai encarar a UERJ.
          </p>
        </motion.div>

        <div className="relative z-10 grid gap-5">
          {PILARES.map((p, i) => (
            <motion.div
              key={p.titulo}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.12, duration: 0.5 }}
              className="flex items-start gap-3.5"
            >
              <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-400 flex items-center justify-center">
                <p.icone size={17} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-bold text-white">{p.titulo}</p>
                <p className="text-[13px] text-ink-400 leading-5 mt-0.5">{p.texto}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ===== FORMULÁRIO ===== */}
      <div className="relative flex items-center justify-center min-h-screen lg:min-h-0 px-4 py-10 sm:px-8">
        <BotaoTema className="absolute top-4 right-4" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* marca no mobile (o painel esquerdo some) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img
              src="/logo-uerj.jpeg"
              alt="Pré-Vestibular UERJ Para Todos"
              className="w-40 rounded-2xl select-none"
              draggable={false}
            />
          </div>

          <h2 className="font-display text-2xl font-black text-white tracking-tight">
            {TEXTOS[modo].titulo}
          </h2>
          <p className="text-sm text-ink-400 mt-1.5 mb-7">{TEXTOS[modo].sub}</p>

          {/* Alternância Entrar / Criar conta */}
          <div className={`relative flex p-1 bg-ink-900 border border-white/[0.06] rounded-xl mb-6 ${ehRecuperar ? 'hidden' : ''}`}>
            {['login', 'cadastro'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModo(m)}
                className={`relative flex-1 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                  modo === m ? 'text-ink-950' : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                {modo === m && (
                  <motion.span
                    layoutId="seletor-modo"
                    className="absolute inset-0 bg-gold-400 rounded-lg"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </span>
              </button>
            ))}
          </div>

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

          <form onSubmit={onSubmit} className="space-y-4">
            {ehCadastro && (
              <CampoTexto
                rotulo="Nome"
                type="text"
                required
                maxLength={80}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            )}

            <CampoTexto
              rotulo="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
            />

            {!ehRecuperar && (
              <div>
                <CampoSenha
                  rotulo="Senha"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={ehCadastro ? `Mínimo de ${SENHA_MINIMA} caracteres` : '••••••••'}
                  autoComplete={ehCadastro ? 'new-password' : 'current-password'}
                />

                {!ehCadastro && (
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => trocarModo('recuperar')}
                      className="text-xs text-ink-400 hover:text-gold-300 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}
              </div>
            )}

            {ehCadastro && (
              <CampoSenha
                rotulo="Confirmar senha"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            )}

            <Botao
              type="submit"
              disabled={carregando}
              tamanho="lg"
              className="w-full mt-2"
            >
              {textoBotao}
            </Botao>
          </form>

          {ehRecuperar ? (
            <Botao variante="fantasma" className="w-full mt-5" onClick={() => trocarModo('login')}>
              <ArrowLeft size={15} /> Voltar para o login
            </Botao>
          ) : (
          <p className="mt-7 text-center text-sm text-ink-400">
            {ehCadastro ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
            <button
              type="button"
              onClick={() => trocarModo(ehCadastro ? 'login' : 'cadastro')}
              className="text-gold-300 hover:text-gold-200 font-semibold transition-colors"
            >
              {ehCadastro ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Login
