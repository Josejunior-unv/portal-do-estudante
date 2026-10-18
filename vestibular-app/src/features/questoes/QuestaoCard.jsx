import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, ExternalLink, Ban } from "lucide-react";
import { DIFICULDADES, nomeMateria } from "@/features/questoes/questoesUtils";
import { Bolha, Modal } from "@/components/ui";
import { cx } from "@/components/ui/cx";

// Uma questão, como na prova. Usada no ENEM, no Simulado e na UERJ.
//
// Props:
//  - questao        { index, year, origem, materiaNome, context, files,
//                     alternatives[{letter,text,file}], correctAlternative,
//                     recorte?, apoios?[{imagens,texto}], anulada?, discursiva?,
//                     pdf?, pagina? }
//  - resposta       letra marcada pelo aluno (ou undefined)
//  - onResponder    (letra) => void. Ausente = só leitura
//  - revelar        true = mostra a correção
//  - dificuldade    'facil' | 'media' | 'dificil'

function estadoDaBolha({ letra, resposta, correta, revelar }) {
  const marcada = resposta === letra;
  if (!revelar) return marcada ? "marcada" : "vazia";
  if (letra === correta) return marcada ? "certa" : "gabarito";
  return marcada ? "errada" : "vazia";
}

// Em tela larga o apoio fica aberto ao lado da questão; no celular começa
// recolhido para não empurrar a pergunta para baixo.
const telaLarga = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

function TextoDeApoio({ apoio, indice, total }) {
  const [aberto] = useState(telaLarga);
  return (
    <details open={aberto} className="group mb-4 rounded-2xl border border-white/[0.1] bg-ink-900">
      <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-3 font-display font-bold uppercase tracking-[0.1em] text-sm text-ink-300">
        <span>
          Texto de apoio{total > 1 ? ` ${indice + 1} de ${total}` : ""}
        </span>
        <span className="font-sans normal-case tracking-normal text-xs font-semibold text-ink-200 underline underline-offset-4 group-open:hidden">
          ler o texto
        </span>
        <span className="font-sans normal-case tracking-normal text-xs text-ink-500 hidden group-open:inline">
          recolher
        </span>
      </summary>
      <div className="px-2 pb-2 sm:px-3 sm:pb-3 space-y-2">
        {apoio.imagens?.map((src, i) => (
          <img key={i} src={src} alt="" loading="lazy" className="w-full rounded-lg bg-[#fff]" />
        ))}
        {apoio.texto && <p className="sr-only">{apoio.texto}</p>}
      </div>
    </details>
  );
}

export default function QuestaoCard({ questao, resposta, onResponder, revelar = false, dificuldade }) {
  const [ampliada, setAmpliada] = useState(false);
  // No celular, a imagem da prova encolhida fica ilegível: abre como texto
  // quando dá para ler sem perder nada (sem figura nem fração).
  const [comoTexto, setComoTexto] = useState(() => !telaLarga() && Boolean(questao.textoConfiavel));
  const alternativas = questao.alternatives || [];
  const dif = DIFICULDADES[dificuldade] || null;
  const correta = questao.correctAlternative;
  const acertou = !!resposta && resposta === correta;
  const bloqueado = !onResponder;
  const apoios = questao.apoios || [];
  const temRecorte = !!questao.recorte;
  const linkProva = questao.pdf ? `${questao.pdf}${questao.pagina ? `#page=${questao.pagina}` : ""}` : null;

  return (
    <article
      className={cx(
        apoios.length > 0
          ? "xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start"
          : "max-w-3xl",
      )}
    >
      {apoios.length > 0 && (
        <aside className="xl:sticky xl:top-0 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          {apoios.map((a, i) => (
            <TextoDeApoio key={i} apoio={a} indice={i} total={apoios.length} />
          ))}
        </aside>
      )}

      <div>
      <div className="rounded-2xl border border-white/[0.1] bg-ink-900 overflow-hidden">
        {/* Cabeçalho: como o selo da prova */}
        <header className="flex items-center gap-3 flex-wrap px-4 sm:px-5 py-3 border-b border-white/[0.08]">
          <span className="font-mono font-bold text-laranja text-sm tracking-wide">
            QUESTÃO {String(questao.index).padStart(2, "0")}
          </span>
          <span className="text-sm text-ink-300">{nomeMateria(questao)}</span>
          {dif && (
            <span className="text-sm text-ink-400" title="Dificuldade estimada">
              · {dif.label.toLowerCase()}
            </span>
          )}
          <span className="ml-auto text-sm text-ink-400 tabular-nums">
            {questao.origem || "ENEM"} {questao.year}
          </span>
        </header>

        {questao.anulada && (
          <p className="flex items-start gap-2 px-4 sm:px-5 py-3 bg-amber-400/10 text-amber-300 text-sm border-b border-white/[0.08]">
            <Ban size={16} className="mt-0.5 shrink-0" />
            A UERJ anulou esta questão: na prova, todos ganharam o ponto. Dá para resolver
            para treinar, mas ela não tem resposta oficial.
          </p>
        )}

        <div className="p-4 sm:p-5">
          {temRecorte && !comoTexto ? (
            <figure>
              <button
                type="button"
                onClick={() => setAmpliada(true)}
                className="block w-full rounded-lg bg-[#fff] cursor-zoom-in"
                aria-label="Ampliar a questão"
              >
                <img
                  src={questao.recorte}
                  alt={questao.context?.slice(0, 300) || `Questão ${questao.index}`}
                  className="w-full"
                />
              </button>
              <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <button type="button" onClick={() => setAmpliada(true)} className="inline-flex items-center gap-1.5 font-semibold text-ink-200 hover:text-white underline-offset-4 hover:underline">
                  <Maximize2 size={14} /> Ampliar
                </button>
                <button type="button" onClick={() => setComoTexto(true)} className="font-semibold text-ink-200 hover:text-white underline-offset-4 hover:underline">
                  Ler como texto
                </button>
                {linkProva && (
                  <a href={linkProva} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-ink-200 hover:text-white underline-offset-4 hover:underline">
                    <ExternalLink size={14} /> Ver na prova{questao.pagina ? ` (pág. ${questao.pagina})` : ""}
                  </a>
                )}
              </figcaption>
            </figure>
          ) : (
            <>
              {questao.context && (
                <p className="text-ink-100 text-[17px] leading-8 whitespace-pre-line">{questao.context}</p>
              )}
              {!questao.context && !questao.files?.length && (
                <p className="text-ink-300">Abra a prova original para ler esta questão.</p>
              )}
              {questao.alternativesIntroduction && (
                <p className="text-white font-bold leading-7 mt-4">{questao.alternativesIntroduction}</p>
              )}
              {questao.files?.length > 0 && (
                <div className="flex flex-col gap-4 mt-5">
                  {questao.files.map((imagem, index) => (
                    <img key={index} src={imagem} alt={`Figura da questão ${questao.index}`} loading="lazy" className="w-full rounded-lg border border-white/[0.08] bg-[#fff]" />
                  ))}
                </div>
              )}
              {temRecorte && (
                <button type="button" onClick={() => setComoTexto(false)} className="mt-4 text-sm font-semibold text-ink-200 hover:text-white underline underline-offset-4">
                  Ver como na prova (imagem)
                </button>
              )}
            </>
          )}
        </div>

        {/* Alternativas */}
        {alternativas.length > 0 && (temRecorte && !comoTexto ? (
          // A prova já mostra as alternativas: aqui fica o cartão-resposta.
          <fieldset className="px-4 sm:px-5 py-4 border-t border-white/[0.08] bg-ink-850">
            <legend className="sr-only">Marque sua resposta</legend>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-display font-bold uppercase tracking-[0.1em] text-sm text-ink-300" aria-hidden>
                Sua resposta
              </span>
              <div className="flex gap-3">
                {alternativas.map((alt) => {
                  const estado = estadoDaBolha({ letra: alt.letter, resposta, correta, revelar });
                  return (
                    <motion.button
                      key={alt.letter}
                      type="button"
                      disabled={bloqueado}
                      whileTap={!bloqueado ? { scale: 0.9 } : undefined}
                      onClick={() => onResponder?.(alt.letter)}
                      aria-pressed={resposta === alt.letter}
                      aria-label={`Alternativa ${alt.letter}`}
                      className={cx("rounded-full", bloqueado ? "cursor-default" : "hover:[&>span]:border-ink-100")}
                    >
                      <Bolha letra={alt.letter} estado={estado} tamanho="lg" />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        ) : (
          <ul className="border-t border-white/[0.08]" aria-label="Alternativas">
            {alternativas.map((alt) => {
              const estado = estadoDaBolha({ letra: alt.letter, resposta, correta, revelar });
              return (
                <li key={alt.letter} className="border-b border-white/[0.06] last:border-b-0">
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => onResponder?.(alt.letter)}
                    aria-pressed={resposta === alt.letter}
                    aria-label={`Alternativa ${alt.letter}: ${alt.text?.trim() || "em imagem"}`}
                    className={cx(
                      "w-full flex items-start gap-3.5 px-4 sm:px-5 py-3.5 text-left transition-colors",
                      !bloqueado && "hover:bg-white/[0.04]",
                      bloqueado && "cursor-default",
                    )}
                  >
                    <Bolha letra={alt.letter} estado={estado} />
                    <span className="flex-1 pt-1.5 text-[16px] leading-7 text-ink-100">
                      {alt.text?.trim() ? alt.text : <em className="text-ink-400">Alternativa em imagem: veja a prova.</em>}
                      {alt.file && (
                        <img src={alt.file} alt={`Alternativa ${alt.letter}`} loading="lazy" className="mt-3 rounded-lg border border-white/[0.08]" />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

        {alternativas.length === 0 && questao.discursiva && (
          <p className="px-4 sm:px-5 py-4 border-t border-white/[0.08] bg-ink-850 text-sm text-ink-300 leading-6">
            Questão discursiva: escreva sua resposta no caderno e compare com o padrão de
            resposta da UERJ, na Biblioteca.
          </p>
        )}
      </div>

      {/* Correção, explicada */}
      <AnimatePresence>
        {revelar && resposta && correta && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cx(
              "mt-3 px-4 py-3 rounded-xl border text-[15px] leading-6",
              acertou
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-rose-400/40 bg-rose-400/10 text-rose-300",
            )}
            role="status"
          >
            {acertou ? (
              <>Você marcou <strong>{resposta}</strong>: resposta certa.</>
            ) : (
              <>
                Você marcou <strong>{resposta}</strong>. A resposta oficial é{" "}
                <strong>{correta}</strong>.
              </>
            )}
          </motion.p>
        )}
      </AnimatePresence>

      </div>

      <Modal aberto={ampliada} onFechar={() => setAmpliada(false)} className="max-w-5xl">
        <div className="overflow-auto max-h-[85vh] bg-[#fff]">
          <img src={questao.recorte} alt={questao.context?.slice(0, 300) || ""} className="w-[960px] max-w-none sm:max-w-full sm:w-full" />
        </div>
      </Modal>
    </article>
  );
}
