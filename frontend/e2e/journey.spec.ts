import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const shots = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

async function axe(page: Page, disabled: string[] = []) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).disableRules(disabled).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

async function noHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

/** Nada de nota, número de qualidade ou evolução nas telas de resultado. */
async function noClaims(page: Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\d+\s*(%|°|\/10)/);
  expect(text).not.toMatch(/\b(score|acurácia|precisão|confiança do modelo|você melhorou|ângulo ideal)\b/i);
}

async function pick(page: Page, title: string) {
  await page.goto("#/escolher");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Enviar vídeo" }).click();
}

/** Toca na pessoa maior: o jogador em primeiro plano. */
async function tapPlayer(page: Page) {
  const boxes = page.locator(".caixa");
  await expect(boxes.first()).toBeVisible();
  let bestIndex = 0;
  let bestHeight = 0;
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = await boxes.nth(i).boundingBox();
    if (box && box.height > bestHeight) { bestHeight = box.height; bestIndex = i; }
  }
  await boxes.nth(bestIndex).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
});

test("percurso completo, do primeiro uso à exclusão", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Veja seu saque de fora" })).toBeVisible();
  await expect(page.getByText("Demonstração: vídeos e dados simulados")).toBeVisible();
  await shot(page, "01-abertura");
  await axe(page);
  await page.getByRole("button", { name: "Começar" }).click();

  await expect(page.getByRole("heading", { name: "Como filmar sozinho" })).toBeVisible();
  await shot(page, "02-como-filmar");
  await axe(page);
  await page.getByRole("button", { name: "Já gravei: escolher vídeo" }).click();

  await expect(page.getByRole("heading", { name: "Escolha o vídeo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escolha um vídeo para enviar" })).toBeDisabled();
  await page.getByRole("button", { name: /Saque na quadra 2/ }).click();
  await shot(page, "03-escolher-video");
  await axe(page);
  for (const box of await page.locator(".video-opcao").all()) {
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Enviar vídeo" }).click();

  await expect(page.getByRole("heading", { name: "Toque em você" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Toque em você para continuar" });
  await expect(confirm).toBeDisabled(); // nada vem pré-selecionado
  await expect(page.locator('.caixa[aria-pressed="true"]')).toHaveCount(0);
  await shot(page, "04-selecionar");
  await axe(page);
  await tapPlayer(page);
  await shot(page, "05-selecionado");
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();

  await expect(page.getByRole("heading", { name: "Processando o vídeo" })).toBeVisible();
  await expect(page.getByText("Não diz nada sobre a qualidade")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("%");
  await shot(page, "06-processando");
  await axe(page);

  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Jogador acompanhado neste trecho")).toBeVisible();
  await noClaims(page);
  await noHorizontalOverflow(page);
  await shot(page, "07-revisao");
  await axe(page);

  // Controles
  const tempo = page.getByTestId("tempo");
  await expect(tempo).toHaveText("0:00,0");
  await page.getByRole("button", { name: "Próximo quadro" }).click();
  await expect(tempo).toHaveText("0:00,0");
  await page.getByRole("slider", { name: "Posição no vídeo" }).fill("90");
  await expect(tempo).not.toHaveText("0:00,0");
  await page.getByRole("button", { name: "Esqueleto ligado" }).click();
  await expect(page.getByRole("button", { name: "Esqueleto desligado" })).toBeVisible();
  await page.getByRole("button", { name: "Esqueleto desligado" }).click();
  await page.getByRole("button", { name: "Velocidade normal" }).click();
  await expect(page.getByRole("button", { name: "Metade da velocidade" })).toBeVisible();
  await page.getByRole("button", { name: "Reproduzir" }).click();
  await page.getByRole("button", { name: "Pausar" }).click();

  // Detalhes sob demanda: medida sem valor
  await page.getByText("Medidas do movimento").click();
  await expect(page.getByText("Em validação. Nenhum valor é mostrado.")).toBeVisible();
  await noClaims(page);

  // Histórico
  await page.getByRole("button", { name: "Seus saques" }).click();
  await expect(page.getByRole("heading", { name: "Seus saques" })).toBeVisible();
  await expect(page.getByText("Saque na quadra 2")).toBeVisible();
  await shot(page, "08-historico");
  await axe(page);

  // Reencontrar e excluir
  await page.getByRole("button", { name: /Saque na quadra 2/ }).click();
  await page.getByRole("button", { name: "Excluir vídeo e dados" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, "09-confirmar-exclusao");
  await axe(page);
  await page.getByRole("dialog").getByRole("button", { name: "Excluir vídeo e dados" }).click();
  await expect(page.getByRole("heading", { name: "Vídeo e dados excluídos" })).toBeVisible({ timeout: 8000 });
  await shot(page, "10-excluido");
  await page.getByRole("button", { name: "Ir para Seus saques" }).click();
  await expect(page.getByText("Nenhum vídeo guardado")).toBeVisible();
  await shot(page, "11-historico-vazio");
  await axe(page);
});

test("perda do jogador fica explícita e permite nova seleção", async ({ page }) => {
  await page.goto("#/inicio");
  await pick(page, "Saque e busca da bola");
  await expect(page.getByRole("heading", { name: "Toque em você" })).toBeVisible();
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("heading", { name: "Perdi você neste ponto" })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.trilho-seg[data-com="nao"]')).toHaveCount(1);
  await noClaims(page);
  await shot(page, "12-jogador-perdido");
  await axe(page);
  const before = await page.getByTestId("cobertura").textContent({ timeout: 1000 }).catch(() => null);

  await page.getByRole("button", { name: "Ver no vídeo" }).click();
  await expect(page.getByRole("img", { name: /Não há esqueleto neste quadro/ })).toBeVisible();

  await page.getByRole("button", { name: "Escolher você de novo" }).click();
  await expect(page.getByRole("heading", { name: "Toque em você de novo" })).toBeVisible();
  await shot(page, "13-escolher-de-novo");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("heading", { name: "Um trecho ficou sem esqueleto" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Escolher você de novo" })).toHaveCount(0);
  await page.getByText("Detalhes técnicos").click();
  const after = await page.getByTestId("cobertura").textContent();
  expect(after).not.toBe(before);
  await shot(page, "14-apos-nova-selecao");
});

test("duas pessoas próximas interrompem em vez de escolher sozinho", async ({ page }) => {
  await pick(page, "Saque com alguém passando");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("heading", { name: "Duas pessoas ficaram muito próximas" })).toBeVisible({ timeout: 15000 });
  await shot(page, "15-ambiguo");
  await axe(page);
});

test("captura inadequada: pés fora, com replay preservado e sem julgamento", async ({ page }) => {
  await pick(page, "Saque com o celular perto");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("heading", { name: "Seus pés ficaram fora da imagem" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Processamento concluído")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible();
  await page.getByText("Medidas do movimento").click();
  await expect(page.getByText(/Nenhum valor foi calculado/)).toBeVisible();
  await noClaims(page);
  await shot(page, "16-pes-fora");
  await axe(page);
});

test("ninguém encontrado: uma causa, uma ação, e o vídeo continua disponível", async ({ page }) => {
  await pick(page, "Saque visto de longe");
  await expect(page.getByRole("heading", { name: "Não encontrei ninguém neste vídeo" })).toBeVisible({ timeout: 8000 });
  await shot(page, "17-ninguem");
  await axe(page);
  await page.getByRole("button", { name: "Rever o vídeo sem esqueleto" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Esqueleto/ })).toHaveCount(0);
  await expect(page.getByText("Não analisado")).toBeVisible();
  await shot(page, "18-rever-sem-esqueleto");
  // Excluir a partir da revisão sem análise também precisa concluir.
  await page.getByRole("button", { name: "Excluir vídeo e dados" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir vídeo e dados" }).click();
  await expect(page.getByRole("heading", { name: "Vídeo e dados excluídos" })).toBeVisible({ timeout: 8000 });
});

test("sem tempo confiável, não mostra um relógio inventado", async ({ page }) => {
  await pick(page, "Saque em câmera lenta");
  await expect(page.getByRole("heading", { name: "O tempo deste vídeo não é confiável" })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Rever o vídeo sem esqueleto" }).click();
  await expect(page.getByTestId("tempo")).toHaveText("Tempo indisponível");
  await axe(page);
});

test("falha técnica não culpa o vídeo e tentar de novo funciona", async ({ page }) => {
  await pick(page, "Saque durante uma falha");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("heading", { name: "O processamento falhou" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Isso não é uma avaliação do seu saque/)).toBeVisible();
  await shot(page, "19-falha");
  await axe(page);
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible({ timeout: 15000 });
});

test("envio interrompido retoma; arquivo recusado explica", async ({ page }) => {
  await pick(page, "Saque enviado com sinal fraco");
  await expect(page.getByRole("heading", { name: "O envio parou" })).toBeVisible({ timeout: 8000 });
  await shot(page, "20-envio-parado");
  await axe(page);
  await page.getByRole("button", { name: "Continuar envio" }).click();
  await expect(page.getByRole("heading", { name: "Toque em você" })).toBeVisible({ timeout: 8000 });

  await pick(page, "Treino inteiro");
  await expect(page.getByRole("heading", { name: "Este vídeo é longo demais" })).toBeVisible({ timeout: 8000 });
  await shot(page, "21-arquivo-recusado");
});

test("cancelamento mantém o vídeo e permite analisar de novo", async ({ page }) => {
  await pick(page, "Saque na quadra 2");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await page.getByRole("button", { name: "Cancelar análise" }).click();
  await expect(page.getByRole("heading", { name: "Análise cancelada" })).toBeVisible();
  await shot(page, "22-cancelada");
  await axe(page);
  await page.getByRole("button", { name: "Analisar de novo" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible({ timeout: 15000 });
});

test("sem estouro horizontal em tela de 320 px e em paisagem", async ({ page }) => {
  await pick(page, "Saque e busca da bola");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible({ timeout: 15000 });
  await page.setViewportSize({ width: 320, height: 640 });
  await noHorizontalOverflow(page);
  await shot(page, "23-revisao-320");
  await page.setViewportSize({ width: 844, height: 390 });
  await noHorizontalOverflow(page);
  await shot(page, "24-revisao-paisagem");
});

test("alvos de toque têm ao menos 44 px na revisão", async ({ page }) => {
  await pick(page, "Saque na quadra 2");
  await tapPlayer(page);
  await page.getByRole("button", { name: "Sou eu: continuar" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible({ timeout: 15000 });
  const small = await page.evaluate(() => [...document.querySelectorAll("button, summary, input[type=range]")]
    .filter((el) => (el as HTMLElement).offsetParent !== null)
    .map((el) => ({ t: (el.textContent ?? "").slice(0, 30), h: el.getBoundingClientRect().height }))
    .filter((x) => x.h < 44));
  expect(small).toEqual([]);
});
