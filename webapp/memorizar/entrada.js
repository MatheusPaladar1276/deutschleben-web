// Ponto de entrada do Memorizar.
// - Prévia local de demonstração: só em localhost com o adaptador de demonstração.
// - Produção (DL Web + Firebase): ciclo na conta do usuário, com releitura offline.
const demoLocal = ['localhost', '127.0.0.1'].includes(location.hostname) && window.DL_MEMORIZAR_DEMO;

function aviso(mensagem) {
  const p = document.createElement('p');
  p.setAttribute('role', 'alert');
  p.textContent = 'Não foi possível abrir Memorizar: ' + mensagem;
  document.querySelector('.navegacao')?.append(p);
}

if (demoLocal) {
  // A interface usa seus valores padrão de demonstração (sem nuvem).
  import('./interface.js').catch(e => aviso(e.message));
} else {
  (async () => {
    const nuvem = await import('./nuvem.js');
    const armazenamentoHtml = `
      <p>O ciclo fica guardado na sua conta do Deutschleben. Ao abrir o Memorizar em outro aparelho
        com o mesmo login, o ciclo em andamento é carregado da sua conta; os itens são os mesmos.</p>
      <p>Uma cópia local nesta máquina permite reler o ciclo sem internet. Iniciar um novo conjunto ou
        alterar o prazo exige conexão e só substitui o ciclo quando você confirma. Sair da conta remove a
        cópia local deste aparelho. O relógio usa a data deste aparelho; a contagem é por dias de calendário
        locais, inclui o dia de início e avança a cada meia-noite.</p>`;
    window.DL_MEMORIZAR_CTX = {
      selo: 'na sua conta',
      independente: true,
      sessao: nuvem.sessao,
      contaPronta: nuvem.contaPronta,
      msgLendo: 'Lendo o ciclo da sua conta…',
      msgSalvo: 'Ciclo salvo na sua conta. Os itens ficam fixos e aparecem nos seus aparelhos com o mesmo login.',
      armazenamentoHtml,
      carregarCiclo: nuvem.carregarCiclo,
      salvarCiclo: nuvem.salvarCiclo,
      verificarOffline: nuvem.verificarOffline,
      // O Card real do texto aberto, lido da conta; null quando o texto não tem Card.
      carregarRegistro: async aberto => {
        const card = await nuvem.carregarCard(aberto.id, aberto.uid);
        return card ? { textoId: aberto.id, original: aberto.conteudo, card } : null;
      },
      // Produção não usa a revisão da demonstração: só o Card e os acervos reais.
      revisao: () => [],
    };
    await import('./interface.js');
  })().catch(e => aviso(e.message));
}
