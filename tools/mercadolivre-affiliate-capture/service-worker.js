chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const candidates = [
          ...document.querySelectorAll('input, textarea'),
        ].map((element) => element.value || '').filter(Boolean);

        const links = [
          ...document.querySelectorAll('a[href]'),
        ].map((element) => element.href || '').filter(Boolean);

        const all = [...candidates, ...links];
        const affiliate = all.find((value) =>
          /^https:\/\/(www\.)?meli\.la\//i.test(value.trim())
        );

        return affiliate || '';
      }
    });

    if (!result) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert('Nenhum link meli.la encontrado nesta página. Gere o link pela Barra de Afiliados/Central de Afiliados e tente novamente.')
      });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [result],
      func: async (value) => {
        await navigator.clipboard.writeText(value);
        alert('Link de afiliado Mercado Livre copiado para a área de transferência.');
      }
    });
  } catch {
    // Keep the extension silent when the current tab blocks script execution.
  }
});
