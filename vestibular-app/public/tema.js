// Aplica o tema ANTES do primeiro paint (evita flash de tema errado):
// o escolhido pelo aluno; se ele nunca escolheu, o do sistema; papel
// (claro) por padrão. Arquivo próprio (e não inline no index.html) para a
// Content-Security-Policy não precisar de 'unsafe-inline' em script-src.
(function () {
  var tema = "light";
  try {
    var salvo = localStorage.getItem("tema");
    if (salvo === "light" || salvo === "dark") tema = salvo;
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) tema = "dark";
  } catch {
    // sem localStorage: fica no padrão
  }
  document.documentElement.dataset.theme = tema;
})();
