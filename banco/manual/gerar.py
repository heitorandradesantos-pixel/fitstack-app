# Gera os manuais do FitStack (HTML) — recepção/colaboradores, gerente, dono e sócios.
import os, html
OUT = "/home/claude/fitstack-app/manual"

CSS = """
:root{--ink:#1b1714;--muted:#6b625b;--line:#e4ddd6;--bg:#ffffff;--soft:#f6f2ee;--acc:#E8530A;--acc-soft:#fdeee5;--ok:#1f8a55;--ok-soft:#e6f4ec;--bad:#c23b36;--bad-soft:#fbe9e8;--warn:#9a6a00;--warn-soft:#fdf3dc}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55}
.wrap{max-width:860px;margin:0 auto;padding:28px 18px 60px}
.topo{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:26px}
.marca{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.14em;font-size:14px}
.marca i{display:grid;grid-template-columns:9px 9px;gap:2px}.marca i b{width:9px;height:9px;background:var(--acc);display:block}.marca i b:last-child{background:transparent;border:2px solid var(--acc)}
.baixar{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;font-size:15px}
.capa{border-radius:14px;background:var(--ink);color:#fff;padding:30px 26px;margin-bottom:28px}
.capa small{display:block;letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:#ffb08a;font-weight:700}
.capa h1{font-size:38px;line-height:1.05;margin:8px 0 10px;letter-spacing:-.01em}
.capa p{margin:0;color:#ddd5ce;font-size:16px}
h2{font-size:25px;line-height:1.15;margin:44px 0 6px;padding-top:6px;border-top:3px solid var(--ink)}
h2 .n{color:var(--acc);margin-right:8px}
h3{font-size:18px;margin:26px 0 8px}
p{margin:8px 0}
.lead{color:var(--muted);margin:0 0 14px}
.indice{background:var(--soft);border-radius:12px;padding:16px 20px}
.indice b{display:block;margin-bottom:6px}
.indice ol{margin:0;padding-left:22px;columns:2;column-gap:28px}
.indice li{margin:3px 0;break-inside:avoid}
.passos{list-style:none;margin:12px 0;padding:0;counter-reset:p}
.passos>li{counter-increment:p;position:relative;padding:12px 14px 12px 64px;border:1px solid var(--line);border-radius:10px;margin:8px 0;break-inside:avoid;background:#fff}
.passos>li::before{content:"PASSO " counter(p);position:absolute;left:10px;top:12px;width:46px;font-size:10px;font-weight:800;letter-spacing:.06em;color:#fff;background:var(--acc);border-radius:6px;text-align:center;padding:5px 2px;line-height:1.15}
.passos>li .ve{display:block;color:var(--muted);font-size:14px;margin-top:3px}
.passos>li .ve::before{content:"👀 O que aparece: ";font-weight:700;color:var(--ink)}
.botao{display:inline-block;border:1.5px solid var(--ink);border-radius:6px;padding:0 7px;font-weight:800;font-size:13px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;background:#fff}
.botao.lar{background:var(--acc);border-color:var(--acc);color:#fff}
.botao.zap{background:#25D366;border-color:#25D366;color:#06210f;text-transform:none;letter-spacing:0}
.box{border-radius:10px;padding:12px 14px 12px 14px;margin:12px 0;break-inside:avoid;border-left:5px solid}
.box b.t{display:block;margin-bottom:2px}
.dica{background:var(--ok-soft);border-color:var(--ok)}
.atencao{background:var(--warn-soft);border-color:#d99a00}
.nunca{background:var(--bad-soft);border-color:var(--bad)}
.regra{background:var(--acc-soft);border-color:var(--acc)}
figure{margin:14px 0 18px;break-inside:avoid}
figure img{width:100%;height:auto;border:1px solid var(--line);border-radius:10px;display:block}
figure.cel img{max-width:300px;margin:0 auto}
figure.meio img{max-width:420px;margin:0 auto}
figcaption{font-size:13px;color:var(--muted);text-align:center;margin-top:6px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px;break-inside:auto}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:var(--soft);font-size:13px;letter-spacing:.03em;text-transform:uppercase}
tr{break-inside:avoid}
.check{list-style:none;padding:0;margin:10px 0}
.check li{padding:7px 0 7px 34px;position:relative;border-bottom:1px dashed var(--line)}
.check li::before{content:"";position:absolute;left:4px;top:9px;width:18px;height:18px;border:2px solid var(--ink);border-radius:4px}
.check li b.h{display:inline-block;min-width:62px;color:var(--acc)}
.rodape{margin-top:50px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media (max-width:640px){.capa h1{font-size:30px}.indice ol{columns:1}.passos>li{padding-left:14px;padding-top:40px}.passos>li::before{top:10px;left:14px;width:auto;padding:4px 8px}}
@media print{
  @page{size:A4;margin:13mm 12mm 14mm}
  body{font-size:12.5px}
  .wrap{max-width:none;padding:0}
  .topo .baixar{display:none}
  h2{break-before:page;margin-top:0}
  h2.sem-quebra{break-before:auto;margin-top:28px}
  .capa{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .box,.passos>li::before,.botao,th,.indice{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  figure img{max-height:92mm;width:auto;max-width:100%;margin:0 auto}
  figure.cel img{max-height:80mm}
  a{color:inherit;text-decoration:none}
}
"""

def B(t, cls=""):
    return f'<span class="botao {cls}">{t}</span>'
def passos(*itens):
    out = []
    for it in itens:
        if isinstance(it, tuple) and it[1]:
            out.append(f'<li>{it[0]}<span class="ve">{it[1]}</span></li>')
        elif isinstance(it, tuple):
            out.append(f'<li>{it[0]}</li>')
        else:
            out.append(f'<li>{it}</li>')
    return '<ol class="passos">' + ''.join(out) + '</ol>'
def box(tipo, titulo, txt):
    return f'<div class="box {tipo}"><b class="t">{titulo}</b>{txt}</div>'
def fig(img, leg, cls=""):
    return f'<figure class="{cls}"><img src="img/{img}.jpg" alt="{html.escape(leg)}" loading="lazy"><figcaption>{leg}</figcaption></figure>'
def tabela(cab, linhas):
    h = '<table><thead><tr>' + ''.join(f'<th>{c}</th>' for c in cab) + '</tr></thead><tbody>'
    for l in linhas:
        h += '<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>'
    return h + '</tbody></table>'
def check(itens):
    return '<ul class="check">' + ''.join(f'<li>{i}</li>' for i in itens) + '</ul>'

def pagina(arq, titulo, sub, publico, secoes, pdf):
    ind = ''.join(f'<li>{s[0]}</li>' for s in secoes)
    corpo = ''
    for i, (t, conteudo) in enumerate(secoes, 1):
        cls = ' class="sem-quebra"' if i == 1 else ''
        corpo += f'<h2{cls}><span class="n">{i}.</span>{t}</h2>{conteudo}'
    doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo} · FitStack</title><style>{CSS}</style></head><body><div class="wrap">
<div class="topo"><div class="marca"><i><b></b><b></b><b></b><b></b></i>FITSTACK</div><a class="baixar" href="{pdf}" download>Baixar em PDF</a></div>
<div class="capa"><small>Manual · {publico}</small><h1>{titulo}</h1><p>{sub}</p></div>
<div class="indice"><b>O que tem neste manual</b><ol>{ind}</ol></div>
{corpo}
<div class="rodape">FitStack · app.fitstack.com.br · Manual atualizado em novembro de 2026. Se alguma tela estiver diferente do manual, avise o gerente.</div>
</div></body></html>'''
    open(os.path.join(OUT, arq), 'w').write(doc)

# ---------------- textos comuns ----------------
PRIMEIRO_ACESSO = (
    '<p class="lead">Você só faz isso <b>uma vez</b>. Antes, o dono ou o gerente te manda uma mensagem no WhatsApp com o seu <b>e-mail</b> e um <b>código de 6 letras e números</b>.</p>' +
    passos(
        ('Abra a mensagem do WhatsApp que você recebeu da academia.', 'Uma mensagem com o endereço do site, o seu e-mail e o código. Exemplo de código: K7P2QX.'),
        ('Toque no endereço <b>app.fitstack.com.br</b> (ou digite ele no navegador).', 'A tela preta do FitStack com dois botões em cima: Entrar e Primeiro acesso.'),
        ('Toque em ' + B('Primeiro acesso') + '.', 'Um formulário com 4 campos.'),
        ('No campo <b>Seu nome</b>, escreva seu nome e sobrenome.', 'Seu nome aparece no campo.'),
        ('No campo <b>E-mail</b>, escreva o e-mail <b>igualzinho</b> ao da mensagem.', 'Se uma letra estiver diferente, não funciona.'),
        ('No campo <b>Código de acesso</b>, escreva as 6 letras e números da mensagem.', 'Confira letra por letra.'),
        ('No campo <b>Crie uma senha</b>, invente uma senha com pelo menos 6 letras ou números. <b>Anote num lugar seguro.</b>', 'A senha aparece como bolinhas.'),
        ('Toque em ' + B('Criar acesso', 'lar') + '.', 'Você entra no FitStack e vê a tela "Olá, seu nome".'),
    ) + fig('primeiro-acesso', 'Tela de Primeiro acesso', 'meio') +
    box('atencao', 'Deu "código inválido"?', 'Confira se o e-mail está escrito igual ao da mensagem e se o código está certo (0 é zero, O é letra). Se continuar, peça um código novo ao gerente. O código antigo para de valer quando o gerente cancela o cadastro.')
)
ENTRAR = (
    passos(
        ('Abra <b>app.fitstack.com.br</b>.', 'A tela do FitStack.'),
        ('Toque em ' + B('Entrar') + '.', 'Campos de e-mail e senha.'),
        ('Escreva seu e-mail e a sua senha.', ''),
        ('Toque no botão laranja para entrar.', 'A tela "Olá, seu nome" com os seus atalhos.'),
    ) +
    box('dica', 'Dica: salve como atalho', 'No celular, abra o site e escolha "Adicionar à tela de início" (iPhone: botão compartilhar; Android: menu ⋮). Vira um ícone igual a um aplicativo.') +
    '<h3>Esqueci a senha</h3>' +
    passos(
        ('Na tela de entrar, toque em <b>Esqueci minha senha</b>.', 'Um campo para o seu e-mail.'),
        ('Escreva seu e-mail e confirme.', 'Chega um e-mail do FitStack (nao-responda@fitstack.com.br) com o assunto "Crie sua senha nova do FitStack". Olhe também a caixa de spam.'),
        ('Abra o e-mail e toque no botão dele.', 'Uma tela para criar a senha nova.'),
        ('Crie a senha nova e entre normalmente.', ''),
    )
)

# =============== MANUAL DA RECEPÇÃO E COLABORADORES ===============
rec = []
rec.append(('O que é o FitStack', '''
<p>O FitStack é o sistema da academia. Nele você faz <b>três coisas</b>:</p>
''' + tabela(['O quê', 'Para quê', 'Onde fica'], [
    ['<b>Contatos do dia</b>', 'Chamar no WhatsApp quem faz aniversário, quem sumiu, quem está devendo e quem precisa renovar.', 'Aba <b>Contatos do dia</b>'],
    ['<b>Placar do turno</b>', 'Marcar quantas tarefas você fez no seu turno e fechar o turno.', 'Aba <b>Placar</b>'],
    ['<b>Comissão</b>', 'Ver seus pontos e quanto você está ganhando no mês.', 'Dentro do Placar, aba <b>Comissão</b>'],
]) + box('regra', 'Regra de ouro', 'O sistema só sabe o que você marca nele. Se você fez e não marcou, para o sistema você não fez. Se você marcou e não fez, o gerente vê na conferência.') +
'<p>As listas de alunos vêm do <b>EVO</b> sozinhas, todo dia às 5h40 da manhã. Você não precisa copiar nada do EVO.</p>'))

rec.append(('Sua rotina em cada turno', '''
<p class="lead">Faça sempre nesta ordem. É como uma receita: não pula passo.</p>
''' + check([
    '<b class="h">Chegou</b> Entre no FitStack (app.fitstack.com.br) com o <b>seu</b> e-mail e a <b>sua</b> senha.',
    '<b class="h">1º</b> Abra o <b>Placar</b>, confira a data e o seu turno (Manhã, Tarde ou Noite).',
    '<b class="h">2º</b> Leia o quadro <b>Foco</b> do seu turno: ele diz o que é mais importante agora.',
    '<b class="h">3º</b> Abra <b>Contatos do dia</b> e faça as listas do seu turno (veja a tabela abaixo).',
    '<b class="h">Durante</b> A cada tarefa feita, volte no Placar e aperte <b>+</b> na linha certa.',
    '<b class="h">Antes de sair</b> Preencha o <b>Resultado do turno</b> e a <b>Passagem de turno</b>.',
    '<b class="h">Fim</b> Toque em <b>Fechar turno</b> antes do horário limite.',
]) + tabela(['Turno', 'Horário', 'Fechar até', 'O mais importante'], [
    ['Manhã', '5h às 11h', '<b>11:00</b>', 'Parabéns aos aniversariantes <b>até as 10h</b>. Depois: cobrar inadimplentes e retornar para quem visitou e não fechou.'],
    ['Tarde', '11h às 17h', '<b>17:00</b>', 'Encher a agenda: prospecção, alunos sumidos e visitas marcadas para os próximos dias.'],
    ['Noite', '17h às 23h', '<b>23:00</b>', 'Atender bem quem chega, fechar a matrícula de quem visita e pedir indicação para quem está treinando.'],
]) + box('atencao', 'Os horários e as metas podem mudar', 'O gerente pode mudar as metas. O que vale é sempre o que aparece no seu Placar hoje.')))

rec.append(('Entrar pela primeira vez', PRIMEIRO_ACESSO))
rec.append(('Entrar nos outros dias e "esqueci a senha"', ENTRAR + fig('inicio-colaborador', 'Depois de entrar: a tela "Olá" com os seus atalhos')))

rec.append(('Contatos do dia (WhatsApp)', '''
<p class="lead">Aqui estão as pessoas que você precisa chamar hoje. A mensagem já vem pronta. Você só confere e envia.</p>
''' + passos(
    ('Toque na aba ' + B('Contatos do dia') + '.', 'Uma fileira de botões redondos: Aniversários, Sumidos, Inadimplentes, Renovação, Leads, Cancelados. O número do lado é quantas pessoas tem na lista.'),
    ('Toque na lista que você vai fazer agora. Exemplo: <b>Aniversários</b>.', 'Aparecem os nomes. Embaixo de cada nome tem o motivo (exemplo: "Faz 30 anos hoje").'),
    ('Se aparecer uma segunda fileira (exemplo: <b>Hoje</b> e <b>Próximos 7 dias</b>), escolha a de cima primeiro.', 'A lista muda.'),
    ('No primeiro nome, toque no botão verde ' + B('WhatsApp', 'zap') + '.', 'O WhatsApp abre na conversa com o aluno e a mensagem já escrita.'),
    ('Leia a mensagem. Se quiser, mude uma palavra. Depois toque em <b>enviar</b> no WhatsApp.', 'A mensagem vai para o aluno.'),
    ('Volte para o FitStack.', 'O nome agora está riscado, com um ✓ verde, o seu nome e o horário. Ele foi para o fim da lista.'),
    ('Faça o mesmo com o próximo nome, até acabar a lista.', 'Em cima aparece "X para chamar · Y já chamados hoje".'),
) + fig('contatos', 'Contatos do dia: escolha a lista, toque no WhatsApp') + '''
<h3>As listas, uma por uma</h3>
''' + tabela(['Lista', 'Quem está nela', 'O que fazer'], [
    ['<b>Aniversários</b>', 'Quem faz aniversário hoje (e nos próximos 7 dias).', 'Mandar parabéns <b>até as 10h</b>. Contar no Placar em "Parabéns".'],
    ['<b>Sumidos</b>', 'Alunos ativos que não treinam há 7 dias ou mais. Tem 4 filtros: 7 a 14 dias, 15 a 29, 30 ou mais, e quem nunca treinou.', '<b>Comece por 7 a 14 dias</b>: é quem volta mais fácil. Contar em "Alunos sumidos contatados".'],
    ['<b>Inadimplentes</b>', 'Quem tem mensalidade vencida. Filtro "Alunos ativos" e "Ex-alunos". Mostra o valor e há quantos dias está atrasado.', 'Cobrar com educação. Contar em "Inadimplentes cobrados". Se a pessoa pagar, some o valor em "R$ recuperado".'],
    ['<b>Renovação</b>', 'Planos que vencem nos próximos 15 dias e não renovam sozinhos.', 'Convidar para renovar antes de vencer.'],
    ['<b>Leads</b>', 'Pessoas que se cadastraram no mês e ainda não são alunas.', 'Oferecer plano ou aula experimental. Contar em "Retorno a oportunidades".'],
    ['<b>Cancelados</b>', 'Quem cancelou no mês e o motivo.', 'Tentar trazer de volta com educação.'],
]) + fig('contatos-sumidos', 'Lista de sumidos com os filtros de dias') + '''
<h3>Botões de cada nome</h3>
''' + tabela(['Botão', 'O que ele faz'], [
    [B('WhatsApp', 'zap'), 'Abre o WhatsApp com a mensagem pronta <b>e já marca</b> que você chamou.'],
    [B('Chamei'), 'Use quando você falou com a pessoa de outro jeito (ligação, pessoalmente). Só marca, não abre o WhatsApp.'],
    [B('Desfazer'), 'Aparece depois de marcar. Use se marcou errado. Só funciona no mesmo dia.'],
    ['<span class="botao">Sem celular</span>', 'O aluno não tem celular cadastrado no EVO. Peça o número quando ele vier e cadastre no EVO.'],
]) + box('dica', 'Duas pessoas no mesmo turno?', 'Quando uma marca um nome, ele fica riscado para a outra também (atualiza a cada 30 segundos). Assim ninguém manda mensagem duas vezes para o mesmo aluno.') +
box('nunca', 'Nunca', 'Não prometa desconto, isenção ou brinde que o gerente não autorizou. Não cobre de forma grossa nem em tom de ameaça. Não marque "Chamei" se você não falou com a pessoa: o gerente confere.') +
fig('contatos-celular', 'No celular a tela fica assim', 'cel')))

rec.append(('Placar do turno', '''
<p class="lead">O Placar é o seu "dever de casa" do turno. Cada linha é uma tarefa com uma meta. Você aperta <b>+</b> cada vez que faz uma.</p>
''' + passos(
    ('Toque na aba ' + B('Placar') + '.', 'Abre o "Placar de Turnos", na aba Recepção.'),
    ('Confira a <b>Data</b>. Tem que ser hoje.', 'A data aparece no campo da esquerda.'),
    ('Toque no seu turno: ' + B('Manhã') + ', ' + B('Tarde') + ' ou ' + B('Noite') + '.', 'O botão fica laranja. As tarefas do turno aparecem embaixo, numeradas.'),
    ('Confira o campo <b>Seu nome</b>.', 'Ele já vem preenchido com o nome da sua conta.'),
    ('Leia o quadro <b>Foco</b>.', 'Ele diz o que é mais importante no seu turno.'),
    ('Faça as tarefas <b>na ordem dos números</b> (1, 2, 3…). A cada tarefa feita, toque em <b>+</b> na linha dela.', 'O número sobe, a barrinha anda e a porcentagem do lado direito ("Dever de casa do turno") aumenta.'),
    ('Apertou + sem querer? Toque em <b>−</b>.', 'O número diminui.'),
) + fig('placar-recepcao', 'Placar da recepção: tarefas numeradas, + e −, e a porcentagem à direita') + '''
<h3>O que cada linha quer dizer</h3>
''' + tabela(['Tarefa', 'Quando conta +1', 'Exemplo'], [
    ['<b>Parabéns aos aniversariantes</b>', 'Tem 2 números: em <b>Aniversariantes hoje</b> coloque quantos fazem aniversário (veja em Contatos do dia). Em <b>Parabéns enviados</b>, quantos você já mandou.', '4 aniversariantes, mandou para 4 = 100%.'],
    ['<b>Inadimplentes cobrados</b>', 'Cada aluno devendo que você chamou.', 'Chamou 15 da lista = 15.'],
    ['<b>Retorno a oportunidades</b>', 'Cada pessoa que visitou ou fez free pass e ainda não fechou, e você retornou.', 'Mandou mensagem para 5 visitas de ontem = 5.'],
    ['<b>Prospecção ativa</b>', 'Cada lead parado, ex-aluno ou cancelado que você chamou.', ''],
    ['<b>Prospecção no Instagram</b>', 'Cada direct para quem curtiu, comentou ou seguiu a academia e ainda não é aluno.', ''],
    ['<b>Alunos sumidos contatados</b>', 'Cada aluno da lista de sumidos que você chamou.', ''],
    ['<b>Visitas agendadas</b>', 'Cada visita ou free pass com <b>dia e hora marcados</b>.', '"Quinta às 18h" conta. "Vou passar aí" não conta.'],
    ['<b>Indicações coletadas</b>', 'Cada nome e telefone de amigo de aluno, <b>lançado no EVO</b> como oportunidade.', ''],
]) + box('atencao', 'Pode aparecer uma tarefa nova', 'O gerente pode criar atividades novas. Embaixo do nome de cada tarefa tem uma frase explicando como fazer. Leia.') + '''
<h3>Antes de sair: Resultado e Passagem</h3>
''' + passos(
    ('Em <b>Resultado do turno</b>, coloque com + e − quantas <b>Visitas atendidas</b> você teve.', ''),
    ('Coloque quantas <b>Matrículas fechadas</b>.', ''),
    ('Em <b>R$ recuperado</b>, escreva quanto os inadimplentes pagaram no seu turno. Exemplo: 129,90.', 'Se ninguém pagou, deixe vazio.'),
    ('Em <b>Passagem de turno</b> (lado direito), escreva os recados para quem vem depois.', 'Exemplo: "Maria prometeu pagar amanhã. João vem às 18h para visita. Faltou chamar 3 sumidos." Precisa de pelo menos 10 letras.'),
    ('Toque em ' + B('Fechar turno', 'lar') + '.', 'Se você fez menos de 90%, aparece uma pergunta: "Fechar assim mesmo?". Toque em Fechar assim mesmo ou em Voltar para terminar as tarefas.'),
    ('Pronto.', 'Aparece "Turno fechado". Os números travam e o gerente vai conferir.'),
) + box('dica', 'Salva sozinho', 'Cada + que você aperta já fica salvo. Se a internet cair ou a página fechar, é só abrir de novo: os números continuam lá.') +
box('nunca', 'Errou depois de fechar?', 'Você não consegue mudar. Peça ao gerente para tocar em "Reabrir para correção". Nunca peça a senha do gerente.') +
box('atencao', 'Fechar fora do horário', 'Turno fechado depois do horário limite vale <b>metade</b> dos pontos. Turno que não foi fechado vale <b>zero</b>.')))

rec.append(('Comissão: como você ganha', '''
<p class="lead">Toda vez que você fecha um turno, ganha pontos. No fim do mês, um pote de dinheiro é dividido entre quem foi bem.</p>
''' + tabela(['Regra', 'Como funciona hoje'], [
    ['Pontos do turno', 'Cada turno vale até <b>100 pontos</b>. É a porcentagem do seu dever de casa. 80% = 80 pontos.'],
    ['Turno perfeito', '100% de todas as metas e fechado no horário = <b>+20 pontos</b> de bônus.'],
    ['Fechou atrasado', 'Vale <b>metade</b>.'],
    ['Não fechou', 'Vale <b>zero</b>.'],
    ['Quem entra no pote', 'Só quem tiver <b>média de 70% ou mais</b> no mês.'],
    ['O pote', '<b>R$ 700</b> por mês, dividido pelos pontos de quem entrou.'],
    ['Limite', 'Ninguém leva mais que <b>50% do pote</b>.'],
    ['Quando o ponto vale', 'Só depois que o gerente <b>confere</b> o turno. Até lá aparece "aguardando o gerente".'],
]) + box('atencao', 'Os valores podem mudar', 'O dono pode mudar o pote e as regras. Os números certos estão sempre na aba Comissão do Placar.') +
passos(
    ('No Placar, toque na aba ' + B('Comissão') + '.', 'O ranking do mês: posição, média, pontos e quanto cada um está levando.'),
    ('Procure o seu nome.', 'Se aparecer "Fora do pote", sua média está abaixo do mínimo. Feche mais turnos com 90% ou mais para subir.'),
) + fig('comissao', 'Aba Comissão do Placar')))

rec.append(('Avaliações anônimas (todos os colaboradores)', '''
<p class="lead">Às vezes a academia manda um <b>link de avaliação</b> pelo WhatsApp. Pode ser para avaliar o gerente, um colega ou o clima da equipe. Professores, limpeza e manutenção também recebem.</p>
''' + passos(
    ('Toque no link que você recebeu (começa com avaliacao.fitstack.com.br).', 'Abre a avaliação com o nome de quem está sendo avaliado. Não precisa de senha.'),
    ('Leia cada frase e escolha uma nota de <b>1 a 5</b>.', '1 é a nota mais baixa. 5 é a mais alta.'),
    ('Se aparecer a pergunta de 0 a 10 ("quanto você indicaria…"), escolha um número.', ''),
    ('Escreva nos campos abertos o que você pensa de verdade.', 'Pode deixar algum vazio.'),
    ('Toque no botão de enviar no fim.', 'Aparece uma mensagem de agradecimento.'),
) + box('dica', 'É anônimo de verdade', 'O sistema não guarda seu nome, seu e-mail, seu celular nem o horário. Guarda só a data. Ninguém, nem o dono, consegue saber quem respondeu o quê. Por isso, seja sincero e educado.')))

rec.append(('Se der problema', tabela(['Problema', 'O que fazer'], [
    ['Não consigo entrar', 'Confira o e-mail. Use "Esqueci minha senha". Se nunca entrou, use "Primeiro acesso" com o código.'],
    ['Não aparece a aba Contatos do dia ou Placar', 'Você não tem essa permissão. Fale com o gerente.'],
    ['A lista do Contatos do dia está vazia', 'A lista vem do EVO às 5h40. Se estiver vazia a tarde toda, avise o gerente.'],
    ['O WhatsApp não abre', 'Confira se o WhatsApp (ou WhatsApp Web) está instalado e conectado no aparelho.'],
    ['Apareceu "Sem conexão"', 'Confira a internet. Os números não se perdem: atualize a página quando a internet voltar.'],
    ['Fechei o turno com número errado', 'Peça ao gerente para reabrir.'],
    ['Esqueci de fechar ontem', 'Avise o gerente. Turno não fechado vale zero.'],
    ['O nome do aluno está errado', 'O nome vem do EVO. Corrija no cadastro do aluno no EVO.'],
]) + '<h3>Regras de ouro</h3>' + check([
    'Use <b>sempre a sua conta</b>. Nunca entre com o login de outra pessoa, nem do gerente.',
    'Não passe sua senha para ninguém.',
    'Marque só o que você realmente fez.',
    'Feche o turno <b>antes</b> do horário limite.',
    'Escreva a passagem de turno com recados úteis.',
    'Saindo do computador da recepção? Toque em <b>Sair</b>.',
])))

pagina('recepcao.html', 'Manual da Recepção e dos Colaboradores',
       'Passo a passo para entrar, chamar os alunos no WhatsApp, preencher o Placar do turno e entender a comissão.',
       'Recepção e colaboradores', rec, 'manual-recepcao-colaboradores.pdf')

# =============== MANUAL DO GERENTE ===============
ger = []
ger.append(('Seu papel no FitStack', '''
<p>Você é quem faz o sistema funcionar no dia a dia. A recepção faz as tarefas, <b>você confere e cobra</b>, e o dono acompanha tudo.</p>
''' + tabela(['Você pode', 'Onde'], [
    ['Conferir os turnos da recepção e registrar cobrança', 'Placar → aba <b>Gerente</b>'],
    ['Mudar as metas, os horários e criar atividades novas', 'Placar → aba Gerente → <b>Metas e prazos</b>'],
    ['Ver quem chamou cada aluno no WhatsApp', 'Aba <b>Contatos do dia</b>'],
    ['Ver o ranking de comissão', 'Placar → aba <b>Comissão</b>'],
    ['Cadastrar colaboradores (se o dono liberou)', 'Aba <b>Equipe e acessos</b>'],
    ['Criar avaliações (se o dono liberou)', 'Aba <b>Avaliações</b>'],
]) + box('regra', 'Transparência', 'O dono vê tudo o que você faz: se conferiu no prazo, se aprovou turno abaixo da meta e cada mudança de meta (dia, hora, antes e depois). Isso protege você e a equipe.') +
'<p>Para entrar no sistema (primeiro acesso, senha, esqueci a senha), siga o <b>Manual da Recepção</b>, capítulos 3 e 4. É igual para todo mundo.</p>'))

ger.append(('Sua rotina todo dia', check([
    '<b class="h">Até 10h</b> Conferir <b>todos</b> os turnos de ontem (manhã, tarde e noite). O prazo é 10:00 do dia seguinte.',
    '<b class="h">Manhã</b> Abrir <b>Contatos do dia</b> e ver se a recepção mandou parabéns aos aniversariantes até as 10h.',
    '<b class="h">11h</b> Ver se o turno da manhã foi fechado.',
    '<b class="h">Tarde</b> Ver se os sumidos e os inadimplentes estão sendo chamados (Contatos do dia mostra quem chamou e a hora).',
    '<b class="h">17h</b> Ver se o turno da tarde foi fechado.',
    '<b class="h">Noite</b> Ler a passagem de turno.',
    '<b class="h">Semana</b> Olhar a aba Comissão e conversar com quem está fora do pote.',
]) + box('atencao', 'Conferir atrasado conta contra você', 'O dono vê "Conferiu atrasado" e "Não conferiu" no seu placar de gerente.')))

ger.append(('Conferir um turno', '''
<p class="lead">Conferir é olhar os números da recepção e dizer se está dentro do padrão. Turno abaixo de 90% ou fechado fora do horário <b>exige cobrança registrada</b>.</p>
''' + passos(
    ('Entre no FitStack e toque na aba ' + B('Placar') + '.', 'Abre o Placar de Turnos.'),
    ('Toque na aba ' + B('Gerente') + '.', 'Em cima aparece uma faixa amarela: "X turnos esperando sua conferência", com os dias e turnos. Se estiver verde, está tudo conferido.'),
    ('Toque no dia e turno da faixa amarela (exemplo: <b>ter 17/11 · Manhã</b>).', 'A data muda e aparecem 3 cartões: Manhã, Tarde e Noite.'),
    ('No cartão do turno, leia: o nome da recepcionista, a porcentagem e cada tarefa (feito/meta).', 'Exemplo: Inadimplentes 15/15 = fez 15 de 15.'),
    ('Toque em <b>Passagem de turno</b> para ler os recados.', 'O texto que a recepção escreveu.'),
    ('<b>Se está tudo certo (90% ou mais, no horário):</b> toque em ' + B('Dentro do padrão', 'lar') + '.', 'O turno fica conferido. Os pontos da comissão passam a valer.'),
    ('<b>Se está abaixo do padrão:</b> em <b>Medida</b>, escolha o que você fez: Feedback, Advertência verbal, Advertência escrita ou Suspensão.', 'O campo "O que foi cobrado" fica pronto para escrever.'),
    ('Em <b>O que foi cobrado</b>, escreva o que conversou. Exemplo: "Faltaram 8 inadimplentes. Conversei e combinamos fazer amanhã até as 10h."', ''),
    ('Toque em ' + B('Salvar cobrança', 'lar') + '.', 'O turno fica conferido e a cobrança vai para a Escada de consequência, que o dono vê.'),
) + fig('gerente-conferencia', 'Conferência do gerente: faixa amarela com o que falta conferir e o cartão de cada turno') +
box('dica', 'A recepção errou um número?', 'Toque em <b>Reabrir para correção</b>. O turno volta para a recepção corrigir e fechar de novo. Depois você confere.') +
box('nunca', 'Nunca', 'Nunca passe sua senha para a recepção e nunca confira o turno usando o computador da recepção logado na conta dela. Cada um usa o próprio login. Se alguém conferir o próprio turno, o dono vê.') + '''
<h3>Escada de consequência</h3>
<p>Use os degraus em ordem. O sistema mostra para o dono cada cobrança por pessoa, nos últimos 120 dias.</p>
''' + tabela(['Degrau', 'Quando usar'], [
    ['1. Feedback', 'Primeira vez, ou falha pequena. Conversa e combinado.'],
    ['2. Advertência verbal', 'Repetiu a falha depois do feedback.'],
    ['3. Advertência escrita', 'Continuou repetindo.'],
    ['4. Suspensão', 'Falha grave ou reincidência depois da advertência escrita.'],
]) + box('atencao', 'Antes de advertência escrita ou suspensão', 'Confira o modelo e o procedimento com o contador ou um advogado trabalhista. O registro no FitStack é controle interno, não substitui o documento assinado.')))

ger.append(('Mudar metas e criar atividades', '''
<p class="lead">Você pode mudar a meta de cada tarefa em cada turno, os horários e criar tarefas novas. Tudo fica gravado para o dono: quem mudou, quando, o que era e o que ficou.</p>
''' + passos(
    ('No Placar, aba ' + B('Gerente') + ', role a tela até <b>Metas e prazos</b> e toque no <b>+</b>.', 'Uma tabela: cada linha é uma tarefa; as colunas são Manhã, Tarde e Noite.'),
    ('Toque no número que quer mudar e escreva o novo valor.', 'Exemplo: Inadimplentes cobrados na Manhã: de 15 para 20. Meta 0 tira a tarefa daquele turno.'),
    ('Se precisar, mude os horários em <b>Fechar o turno até</b> e <b>Gerente confere até</b>.', ''),
    ('Toque em ' + B('Salvar metas', 'lar') + '.', 'Aparece: "Metas salvas. Já valem para todos, e a mudança ficou registrada para o dono."'),
) + '<h3>Criar uma atividade nova</h3>' + passos(
    ('Em <b>Nova atividade</b>, no campo <b>Nome</b>, escreva o nome. Exemplo: "Avaliações físicas agendadas".', ''),
    ('Em <b>Como fazer</b>, escreva em uma frase como a recepção faz. Exemplo: "Ligar para quem fez matrícula há 30 dias e marcar a reavaliação."', 'Essa frase aparece para a recepção embaixo do nome da tarefa.'),
    ('Toque em ' + B('Adicionar atividade') + '.', 'A atividade entra na tabela com meta 0.'),
    ('Coloque a meta em cada turno e toque em ' + B('Salvar metas', 'lar') + '.', 'A recepção já vê a tarefa nova no Placar dela.'),
) + fig('gerente-metas', 'Metas e prazos: tabela por turno e Nova atividade') +
box('dica', 'Para tirar uma atividade criada', 'Toque em <b>Remover</b> ao lado do nome e depois em Salvar metas. As 8 atividades padrão não têm Remover: para tirar, coloque meta 0.')))

ger.append(('Contatos do dia: acompanhar a recepção', '''
<p>Você vê as mesmas listas da recepção (veja o Manual da Recepção, capítulo 5). A diferença é o seu olhar de gerente:</p>
''' + check([
    'Cada nome marcado mostra <b>quem</b> chamou e <b>a que horas</b>. Confira se bate com o Placar dela.',
    'Em cima aparece "X para chamar · Y já chamados hoje". Se no fim do turno "para chamar" ainda está alto, cobre.',
    'Na lista de Inadimplentes, "Alunos ativos" são prioridade: eles ainda passam pela catraca.',
    'Na lista de Sumidos, a faixa de 7 a 14 dias é a que mais volta.',
    'Se um aluno não tem celular ("Sem celular"), peça para a recepção cadastrar no EVO quando ele vier.',
]) + fig('contatos', 'Contatos do dia')))

ger.append(('Cadastrar um colaborador', '''
<p class="lead">Só aparece se o dono te deu a permissão "Cadastrar colaboradores". Você pode cadastrar apenas <b>colaboradores</b>, com as permissões de Placar e Comissão.</p>
''' + passos(
    ('Toque na aba ' + B('Equipe e acessos') + '.', 'A lista de quem tem acesso.'),
    ('Toque em ' + B('Cadastrar acesso', 'lar') + '.', 'O formulário "Novo acesso".'),
    ('Escreva o <b>Nome</b> e o <b>E-mail</b> da pessoa (peça o e-mail certo, de preferência Gmail).', ''),
    ('Em <b>Cargo</b>, deixe <b>Colaborador</b>.', 'As caixinhas "Preencher o Placar do turno" e "Ver o ranking de comissão" já vêm marcadas.'),
    ('Toque em ' + B('Cadastrar', 'lar') + '.', 'Aparece o <b>código de acesso</b> em letras grandes e um botão de WhatsApp.'),
    ('Toque no botão do <b>WhatsApp</b> e envie para a pessoa.', 'A mensagem já vai com o site, o e-mail e o código.'),
    ('Peça para a pessoa fazer o <b>Primeiro acesso</b> na hora, com você do lado.', 'Ela sai da lista "Cadastrados que ainda não criaram a senha" e entra em "Quem já tem acesso".'),
) + fig('novo-acesso', 'Novo acesso: nome, e-mail, cargo e o que a pessoa pode fazer') +
box('nunca', 'Saiu da academia? Desative no mesmo dia', 'Em Equipe e acessos, toque em <b>Desativar</b> no nome da pessoa. Ela perde o acesso na hora. Nunca deixe ex-funcionário com acesso.') +
box('dica', 'A pessoa perdeu o código', 'Em "Cadastrados que ainda não criaram a senha", toque em <b>Reenviar no WhatsApp</b>.')))

ger.append(('Avaliações anônimas', '''
<p class="lead">Só aparece se o dono te deu a permissão "Criar avaliações". Você pode avaliar as funções da equipe. Avaliações de <b>gerente, coordenador e clima</b> só o dono e os sócios criam e veem.</p>
''' + passos(
    ('Toque na aba ' + B('Avaliações') + '.', 'A lista das avaliações já criadas.'),
    ('Toque em ' + B('Nova avaliação', 'lar') + '.', 'Os modelos prontos: Recepção, Professor de musculação, Professor de aulas coletivas, Limpeza, Vendas, Comercial, Personal, Estagiário, Manutenção, Alunos e outros.'),
    ('Toque no modelo da função.', 'A tela "Montar avaliação" com as perguntas.'),
    ('Em <b>Quem está sendo avaliado</b>, escreva o nome. Se for aula coletiva, escolha a modalidade.', ''),
    ('Leia as perguntas. Para tirar uma, toque no <b>×</b>. Para pôr outra, use os botões de adicionar.', ''),
    ('Toque em ' + B('Criar e gerar link', 'lar') + '.', 'Aparece o link e os botões <b>Copiar link</b> e <b>WhatsApp</b>.'),
    ('Mande o link para quem vai responder.', 'As respostas são anônimas. Ninguém precisa de senha.'),
    ('Para ver o resultado, abra a avaliação na lista e toque em <b>Resultado</b>.', 'Médias por bloco, nota de 0 a 10, pontos fortes, pontos de atenção e respostas abertas. Dá para baixar a planilha.'),
) + box('dica', 'Quantas respostas?', 'Com menos de 3 respostas, fica fácil adivinhar quem respondeu. Espere juntar pelo menos 3 antes de comentar o resultado com a equipe.')))

ger.append(('Se der problema', tabela(['Problema', 'O que fazer'], [
    ['Não aparece a aba Gerente no Placar', 'Peça ao dono a permissão "Ver o Placar de todos e cobrar a equipe".'],
    ['A recepção fechou com número errado', 'Placar → Gerente → no cartão do turno, toque em Reabrir para correção.'],
    ['O botão Dentro do padrão não aparece', 'O turno está abaixo do padrão: registre a cobrança.'],
    ['Mudei uma meta errado', 'Mude de novo e salve. As duas mudanças ficam no histórico do dono.'],
    ['Colaborador não recebe o código', 'Reenviar no WhatsApp. Confira se o e-mail foi digitado certo; se não, cancele e cadastre de novo.'],
    ['Listas do Contatos do dia vazias ou velhas', 'Avise o dono: ele pode tocar em Atualizar agora no Painel.'],
])))

pagina('gerente.html', 'Manual do Gerente',
       'Conferir os turnos, cobrar com registro, mudar metas, acompanhar os contatos e cadastrar a equipe.',
       'Gerente', ger, 'manual-gerente.pdf')

# =============== MANUAL DO DONO E DOS SÓCIOS ===============
don = []
don.append(('Comece por aqui', '''
<p class="lead">Você recebeu da FitStack um e-mail cadastrado e um código. Siga esta ordem no primeiro dia. Leva uns 30 minutos.</p>
''' + check([
    '<b class="h">1</b> Fazer o <b>primeiro acesso</b> e criar sua senha (capítulo 2).',
    '<b class="h">2</b> <b>Ligar o EVO</b> (capítulo 3). Sem isso, o Painel e os Contatos do dia ficam vazios.',
    '<b class="h">3</b> Cadastrar o <b>gerente</b> e a <b>recepção</b> em Equipe e acessos (capítulo 9).',
    '<b class="h">4</b> Conferir as <b>metas do Placar</b> de cada turno (capítulo 10).',
    '<b class="h">5</b> Mandar os <b>manuais</b> para a equipe: aba <b>Manual</b> → botão WhatsApp em cada manual.',
    '<b class="h">6</b> Tem outra unidade? <b>Cadastrar outra unidade</b> (capítulo 4).',
]) + box('dica', 'Dúvida ou problema?', 'Fale com a FitStack pelo e-mail <b>contato@fitstack.com.br</b>. Se puder, mande um print da tela.')))

don.append(('Primeiro acesso', passos(
    ('Abra <b>app.fitstack.com.br</b> no computador ou no celular.', 'A tela do FitStack com Entrar e Primeiro acesso.'),
    ('Toque em ' + B('Primeiro acesso') + '.', 'Um formulário com 4 campos.'),
    ('Escreva <b>seu nome</b>.', ''),
    ('Escreva o <b>e-mail</b> igualzinho ao da mensagem da FitStack.', ''),
    ('Escreva o <b>código de acesso</b> (6 letras e números).', ''),
    ('Crie uma <b>senha</b> com pelo menos 6 caracteres e anote num lugar seguro.', ''),
    ('Toque em ' + B('Criar acesso', 'lar') + '.', 'Você entra como <b>Dono</b> da sua academia.'),
) + fig('primeiro-acesso', 'Tela de Primeiro acesso', 'meio') +
'<h3>Nos outros dias</h3><p>Abra o site, toque em <b>Entrar</b> e use e-mail e senha. Esqueceu? Toque em <b>Esqueci minha senha</b>: chega um e-mail para criar a senha nova.</p>'))

don.append(('Várias unidades num login só', passos(
    ('Na aba ' + B('Início') + ', role até <b>Minhas unidades</b>.', ''),
    ('Toque em ' + B('+ Cadastrar outra unidade') + '.', 'Campos de nome e cidade.'),
    ('Escreva o nome da unidade e a cidade e toque em ' + B('Criar unidade', 'lar') + '.', 'Você já entra na unidade nova, como dono.'),
    ('Para trocar de unidade, use o <b>seletor ao lado de FITSTACK</b>, lá em cima.', 'A tela recarrega com os dados da unidade escolhida.'),
) + box('atencao', 'Cada unidade é separada', 'Cada unidade tem o próprio Painel, Contatos, Placar, equipe e chave do EVO. Cadastre a equipe e ligue o EVO em cada uma.')))

don.append(('Dono e sócio: o que cada um pode', tabela(['', 'Dono', 'Sócio'], [
    ['Ver e fazer tudo no sistema', '✓', '✓'],
    ['Painel do EVO, comissão, histórico, medidas do gerente', '✓', '✓'],
    ['Avaliações de gerente, coordenador e clima', '✓', '✓'],
    ['Cadastrar e remover <b>sócio</b>', '✓', '—'],
    ['Ser alterado ou removido por outra pessoa', 'Nunca', 'Só pelo dono'],
]) + '<p>Este manual mostra as telas que só vocês veem. Para conferir turnos e mudar metas no dia a dia, veja também o Manual do Gerente.</p>'))

don.append(('Segurança (leia primeiro)', check([
    'Ative a <b>verificação em duas etapas (2FA)</b> no seu Gmail. Quem tem seu e-mail consegue trocar sua senha.',
    'Cada pessoa tem o <b>próprio login</b>. Nunca crie uma conta "Recepção" compartilhada.',
    'Ninguém usa a senha do gerente. Se alguém conferir o próprio turno, a conta usada aparece para você.',
    'Funcionário saiu? <b>Desative no mesmo dia</b> em Equipe e acessos.',
    'A chave do EVO fica só no servidor. Ninguém da equipe vê. Nunca cole a chave em conversa, e-mail ou WhatsApp.',
    'Computador da recepção: peça para todos tocarem em <b>Sair</b> ao terminar.',
])))

don.append(('Rotina dos sócios', tabela(['Quando', 'O que olhar', 'Onde'], [
    ['Todo dia (2 minutos)', 'Sumidos, inadimplência e contatos feitos hoje', '<b>Painel</b>'],
    ['Toda segunda', 'Quadro "Onde está o gap" e a evolução da semana. Decidir 1 ação para a semana.', '<b>Painel</b>'],
    ['Toda semana', 'Conferências do gerente: no prazo, atrasadas, aprovou abaixo da meta', 'Placar → <b>Dono</b>'],
    ['Todo mês', 'Ranking e pote da comissão; matrículas x cancelamentos; motivos de cancelamento', 'Placar → <b>Comissão</b> e <b>Painel</b>'],
    ['A cada 3 meses', 'Avaliação anônima do gerente e de clima', '<b>Avaliações</b>'],
])))

don.append(('Painel da academia (EVO)', '''
<p class="lead">O Painel mostra os números da academia direto do EVO. Ele atualiza sozinho todo dia às 5h40.</p>
''' + passos(
    ('Toque na aba ' + B('Painel') + '.', 'Em cima: "Dados do EVO de (data e hora)". Embaixo, os quadros com os números.'),
    ('Leia os 6 números de cima (tabela abaixo).', ''),
    ('Leia o quadro <b>Onde está o gap</b>.', 'Frases prontas dizendo onde a academia está perdendo dinheiro e alunos.'),
    ('Role a tela para ver os gráficos e a evolução dia a dia.', ''),
    ('Precisa do número de agora? Toque em ' + B('Atualizar agora') + '.', 'Leva uns 30 segundos. Só pode atualizar de novo depois de 10 minutos.'),
) + fig('painel', 'Painel da academia') + tabela(['Número', 'O que é', 'Para que serve'], [
    ['<b>Alunos ativos</b>', 'Todos os alunos com plano ativo no EVO, contando Wellhub e VIPs.', 'O tamanho da base.'],
    ['<b>Saldo do mês</b>', 'Matrículas menos cancelamentos do mês.', 'Se é negativo, a academia está encolhendo.'],
    ['<b>Sumidos 7+ dias</b>', 'Alunos ativos que não passam na catraca há 7 dias ou mais, e a % da base.', 'É o próximo cancelamento. Quem não treina não renova.'],
    ['<b>Em atraso</b>', 'Soma das mensalidades vencidas e não pagas nos últimos 120 dias.', 'Dinheiro a recuperar.'],
    ['<b>Renovam em 15 dias</b>', 'Planos que vencem em até 15 dias e não renovam sozinhos (sem recorrentes e sem Wellhub/Gympass/TotalPass).', 'Garantir a renovação antes de vencer.'],
    ['<b>Leads no mês</b>', 'Pessoas cadastradas no EVO como interessadas neste mês.', 'Força da captação.'],
]) + '''
<h3>Gráficos</h3>
''' + tabela(['Gráfico', 'O que mostra'], [
    ['Alunos sumidos', 'Quantos estão sem treinar há 7–14, 15–29, 30+ dias e quantos nunca treinaram.'],
    ['Motivos de cancelamento', 'Os motivos do EVO no mês e o valor dos contratos cancelados. Atenção ao "cancelado automaticamente por inadimplência": é receita que dava para salvar com cobrança.'],
    ['De onde vieram os leads', 'O canal ("Como conheceu") de cada lead. "Não informado" alto = a recepção não está preenchendo no EVO.'],
    ['Contatos feitos hoje', 'Quantos contatos cada pessoa da recepção marcou hoje.'],
    ['Evolução dia a dia', 'Os últimos 14 dias: ativos, sumidos, atraso, matrículas e cancelamentos.'],
])))

don.append(('Equipe e acessos', '''
<p class="lead">Aqui você cria o acesso de cada pessoa e escolhe o que ela pode ver e fazer.</p>
''' + passos(
    ('Toque na aba ' + B('Equipe e acessos') + '.', 'Três partes: Novo acesso, Quem já tem acesso e Cadastrados que ainda não criaram a senha.'),
    ('Toque em ' + B('Cadastrar acesso', 'lar') + '.', 'O formulário Novo acesso.'),
    ('Escreva <b>Nome</b> e <b>E-mail</b>.', ''),
    ('Escolha o <b>Cargo</b>: Sócio, Gerente ou Colaborador.', 'As caixinhas de permissão se marcam sozinhas com o padrão do cargo (tabela abaixo).'),
    ('Marque ou desmarque as permissões, se quiser algo diferente do padrão.', ''),
    ('Toque em ' + B('Cadastrar', 'lar') + '.', 'Aparece o código de 6 letras e números e o botão de WhatsApp.'),
    ('Toque em WhatsApp e envie.', 'A pessoa recebe o passo a passo, o e-mail e o código.'),
) + fig('equipe', 'Equipe e acessos') + tabela(['Permissão', 'O que libera', 'Sócio', 'Gerente', 'Colaborador'], [
    ['Preencher o Placar do turno', 'Placar → Recepção e a aba Contatos do dia', '✓', '✓', '✓'],
    ['Ver o Placar de todos e cobrar a equipe', 'Placar → Gerente (conferir, metas, reabrir)', '✓', '✓', ''],
    ['Ver o ranking de comissão', 'Placar → Comissão', '✓', '✓', '✓'],
    ['Criar avaliações e ver resultados', 'Avaliações (menos gerente, coordenador e clima)', '✓', '✓', ''],
    ['Cadastrar colaboradores', 'Equipe e acessos, só para colaboradores', '✓', '✓', ''],
]) + '''
<h3>Mudar, desativar e reenviar</h3>
''' + tabela(['Quero', 'Faça'], [
    ['Mudar o que alguém pode fazer', 'Toque em <b>Permissões</b> no nome da pessoa, marque/desmarque e salve.'],
    ['Tirar o acesso de quem saiu', 'Toque em <b>Desativar</b>. Vale na hora.'],
    ['A pessoa perdeu o código', 'Em "Cadastrados que ainda não criaram a senha", toque em <b>Reenviar no WhatsApp</b>.'],
    ['Cadastrei o e-mail errado', 'Toque em <b>Cancelar</b> no convite e cadastre de novo.'],
]) + box('regra', 'Só o dono mexe em sócio', 'Sócio vê e faz tudo, mas só o dono cadastra, muda ou remove um sócio. Ninguém consegue mexer na conta do dono.')))

don.append(('Placar: a área do dono', '''
<p class="lead">No Placar, a aba <b>Dono</b> junta tudo: os três turnos do dia, a comissão, os últimos 7 dias, o placar do gerente e o histórico.</p>
''' + passos(
    ('Toque em ' + B('Placar') + ' e depois na aba ' + B('Dono') + '.', 'Visão do dono do dia escolhido.'),
    ('Use as setas ‹ › ou o calendário para trocar o dia.', ''),
    ('Toque em ' + B('Copiar relatório', 'lar') + ' para mandar o resumo do dia no grupo dos sócios.', 'O texto vai para a área de transferência. Cole no WhatsApp.'),
    ('Toque em ' + B('Baixar planilha (30 dias)') + ' se quiser os números no Excel.', ''),
) + fig('dono-placar', 'Placar → Dono') + tabela(['Parte da tela', 'Para que serve'], [
    ['<b>Gerente</b> (à direita)', 'Quantas conferências o gerente fez certo: no prazo, atrasadas, não conferidas e aprovadas abaixo da meta.'],
    ['<b>Registrar medida para o gerente</b>', 'Você registra feedback ou advertência para o gerente. Só você vê esse histórico.'],
    ['<b>Escada de consequência</b>', 'Cada cobrança que o gerente registrou, por pessoa, nos últimos 120 dias.'],
    ['<b>Histórico de alterações</b>', 'Quem mudou metas, prazos ou comissão, quando e o quê (antes → depois). Ninguém consegue apagar.'],
    ['<b>Metas e prazos</b>', 'Igual à tela do gerente (veja o Manual do Gerente, capítulo 4).'],
]) + '<h3>Mudar as regras da comissão</h3>' + passos(
    ('No Placar, toque na aba ' + B('Comissão') + '.', 'O ranking e, para o dono, o quadro <b>Regras da comissão</b>.'),
    ('Mude: <b>Pote (R$)</b>, <b>Média mínima (%)</b>, <b>Teto por pessoa (%)</b> e <b>Bônus turno perfeito</b>.', 'Hoje: R$ 700, 70%, 50% e 20 pontos.'),
    ('Toque em ' + B('Salvar regras', 'lar') + '.', 'O ranking recalcula na hora e a mudança vai para o histórico.'),
) + box('atencao', 'Combine antes de mudar', 'Mudar a regra no meio do mês muda o que a equipe já estava contando receber. Avise antes.')))

don.append(('Avaliações anônimas', '''
<p class="lead">Avaliação anônima por link, sem login para quem responde. Só a data da resposta fica guardada.</p>
''' + passos(
    ('Toque em ' + B('Avaliações') + ' e depois em ' + B('Nova avaliação', 'lar') + '.', 'Os modelos padrão e os seus modelos salvos.'),
    ('Escolha um modelo. Para o gerente, use <b>Gerente</b> (liderança, comunicação, organização e conflitos). Para uma função que não está na lista, use <b>Do zero</b>.', 'A tela Montar avaliação.'),
    ('Preencha <b>Quem está sendo avaliado</b> e confira o <b>público</b> (equipe, alunos ou gestor).', ''),
    ('Tire, mude ou acrescente perguntas, blocos e perguntas abertas.', ''),
    ('Quer usar de novo depois? Toque em ' + B('Salvar como modelo') + '.', 'O modelo aparece em "Seus modelos".'),
    ('Toque em ' + B('Criar e gerar link', 'lar') + ' e mande o link pelo WhatsApp.', ''),
    ('Acompanhe em <b>Resultado</b>. No fim, toque em <b>Encerrar</b>.', 'Encerrada, ninguém mais responde. Dá para Reabrir.'),
) + fig('avaliacoes-modelos', 'Modelos de avaliação') + tabela(['Modelo', 'Para quem'], [
    ['Gerente · Coordenador', 'A equipe avalia a liderança. <b>Só dono e sócios veem.</b>'],
    ['Clima', 'A equipe avalia a academia como lugar de trabalho. <b>Só dono e sócios veem.</b>'],
    ['Recepção · Vendas · Comercial', 'Atendimento e vendas.'],
    ['Professor de musculação · Aulas coletivas (escolhe a modalidade) · Personal · Estagiário', 'Equipe técnica.'],
    ['Limpeza · Manutenção', 'Equipe de apoio.'],
    ['Alunos', 'Os alunos avaliam a academia (NPS).'],
]) + box('dica', 'Leia o resultado com cuidado', 'O resultado mostra médias por bloco, nota de 0 a 10 (NPS), pontos fortes e de atenção (com 6 ou mais perguntas) e as respostas abertas embaralhadas. Use <b>Baixar planilha</b> para guardar.')))

don.append(('Ligar o EVO (passo a passo)', '''
<p class="lead">Com o EVO ligado, o FitStack monta sozinho o Painel e as listas de Contatos do dia (aniversariantes, sumidos, inadimplentes, renovações). Ele <b>só lê</b> o EVO: nunca altera nada lá.</p>
''' + box('atencao', 'Antes de começar', 'Sua academia precisa ter a <b>EVO API</b> liberada no contrato do EVO. Se no passo 4 o cartão da EVO API não aparecer, ou pedir contratação, fale com o suporte do EVO e peça "acesso à EVO API". Faça os passos no computador.') +
'<h3>Parte 1: criar a chave no EVO</h3>' + passos(
    ('Entre no EVO com o seu usuário de dono e escolha a unidade certa.', 'A tela inicial do EVO.'),
    ('No menu da esquerda, toque em <b>Configurações</b>.', 'Abre a lista de configurações.'),
    ('Toque em <b>Integrações</b>.', 'Uma tela com vários cartões de integração.'),
    ('No campo <b>Pesquisar integração</b>, escreva <b>API</b> e toque no cartão <b>EVO</b> ("Utilize a API para acessar e manipular dados do EVO").', 'A tela EVO API, com as abas Consumo, Tokens e Webhook.'),
    ('Toque na aba <b>Tokens</b>.', 'O EVO pode pedir para confirmar seu login e senha. Confirme.'),
    ('Toque em <b>Novo token</b>.', 'Um formulário com o nome e as permissões.'),
    ('No nome, escreva <b>FitStack</b>.', 'Assim você sabe para que serve esse token.'),
    ('Nas permissões, marque <b>só o que for consultar, listar ou ver</b>. Deixe <b>desmarcado</b> tudo que for incluir, alterar, editar, cancelar ou excluir.', 'Se o EVO não separar, pode marcar tudo: o FitStack só lê.'),
    ('Salve.', 'O token aparece na lista.'),
    ('Copie o <b>token</b> (o código grande) e anote o <b>DNS</b>.', 'O DNS é o nome da sua conta no EVO. Ele aparece na tela da EVO API e também no endereço do EVO, logo depois de <b>/app/</b>. Exemplo: em evo5.w12app.com.br/#/app/<b>MINHAACADEMIA</b>/…, o DNS é MINHAACADEMIA.'),
) + box('nunca', 'Não mexa nos outros tokens', 'Se já existir algum token na lista, ele é de outra integração (CRM, site, catraca). Se você apagar, aquela integração para de funcionar.') +
'<h3>Parte 2: colar a chave no FitStack</h3>' + passos(
    ('Abra <b>app.fitstack.com.br</b> e entre como dono.', ''),
    ('Toque na aba ' + B('Integrações') + '.', 'O cartão "Conectar ao EVO".'),
    ('No campo <b>DNS</b>, cole o DNS.', ''),
    ('No campo <b>Token</b>, cole o token.', 'Ele aparece como bolinhas.'),
    ('Toque em ' + B('Salvar chave', 'lar') + '.', '"✅ Chave do EVO salva", com o final do token.'),
    ('Toque em ' + B('Atualizar agora', 'lar') + '.', 'Em uns 30 segundos aparece "Dados do EVO atualizados". Abra o Painel e confira os números.'),
) + fig('integracoes', 'Integrações: chave do EVO salva') + tabela(['Como funciona depois', ''], [
    ['Quando busca', 'Sozinho, todo dia às <b>5h40</b>. E quando você toca em Atualizar agora (no máximo a cada 10 minutos).'],
    ['O que busca', 'Alunos ativos (aniversário, último treino, celular, contrato), mensalidades vencidas, cancelamentos com motivo, matrículas e leads do mês.'],
    ['Quanto gasta da API', 'Cerca de 30 consultas por busca, uns 900 por mês. Confira no EVO na aba <b>Consumo</b> da EVO API.'],
    ['Segurança', 'A chave fica guardada só no servidor. Ninguém da equipe vê, nem você: na tela aparecem só os 4 últimos caracteres.'],
    ['Várias unidades', 'Cada unidade do EVO tem o próprio token. Troque de unidade no FitStack e repita os passos.'],
    ['Trocar ou desligar', 'Em Integrações: <b>Trocar a chave</b> ou <b>Desligar integração</b> (toque duas vezes).'],
])))

don.append(('Se der problema', tabela(['Problema', 'O que fazer'], [
    ['Painel com data velha', 'Toque em Atualizar agora. Se aparecer erro, veja a mensagem em Integrações.'],
    ['"O EVO recusou a chave"', 'O token foi apagado ou venceu (dura 2 anos). Crie um novo no EVO e use Trocar a chave.'],
    ['Alguém não recebe o código', 'Equipe e acessos → Reenviar no WhatsApp.'],
    ['Alguém da recepção vê coisa que não devia', 'Equipe e acessos → Permissões → desmarque.'],
    ['Quero saber quem mudou uma meta', 'Placar → Dono → Histórico de alterações.'],
    ['Esqueci a senha', 'Na tela de entrar, "Esqueci minha senha".'],
])))

_e=[x for x in don if x[0].startswith('Ligar o EVO')][0];don.remove(_e);don.insert(2,_e)
pagina('dono-socios.html', 'Manual do Dono e dos Sócios',
       'Do primeiro acesso ao dia a dia: ligar o EVO, cadastrar a equipe e as unidades, ler o Painel, comissão, histórico e avaliações.',
       'Dono e sócios', don, 'manual-dono-socios.pdf')
print('ok')
