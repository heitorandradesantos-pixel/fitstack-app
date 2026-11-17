// Modelos padrão de avaliação do FitStack.
// {nome} vira o nome de quem é avaliado. {modalidade} vira a aula coletiva escolhida.
window.MODALIDADES = ['Spinning / Bike indoor','Jump','Ritmos / Fit Dance','Zumba','Step','Localizada / Body Pump','Funcional','HIIT','Cross training','Abdominal / Core','Pilates solo','Yoga','Alongamento / Mobilidade','Muay Thai','Boxe / Kickboxing','Jiu-jitsu','Hidroginástica','Natação'];

window.MODELOS = [
{
  id:'gerente', nome:'Gerente', funcao:'gerente', publico:'equipe',
  desc:'Liderança, comunicação, gestão e clima. Modelo usado na avaliação do Rafael.',
  quem:'Nome do gerente',
  blocos:[
    {nome:'Liderança', perguntas:[
      '{nome} demonstra segurança e preparo para liderar a equipe.',
      '{nome} dá o exemplo: chega no horário e faz o que cobra da equipe.',
      '{nome} está disponível quando a equipe precisa de orientação.',
      '{nome} inspira confiança e transmite credibilidade como líder.']},
    {nome:'Comunicação', perguntas:[
      '{nome} transmite as informações de maneira clara.',
      'Eu sei exatamente o que {nome} espera de mim no meu dia de trabalho.',
      '{nome} escuta as opiniões e sugestões da equipe.',
      '{nome} comunica mudanças, metas e decisões com antecedência.',
      '{nome} está aberto a receber críticas e opiniões diferentes.',
      '{nome} mantém uma comunicação respeitosa, mesmo em situações difíceis.']},
    {nome:'Relacionamento e comportamento', perguntas:[
      '{nome} trata todos os colaboradores com respeito.',
      '{nome} trata todos de forma igual, sem favorecimentos.',
      '{nome} mantém uma postura profissional no ambiente de trabalho.',
      '{nome} sabe separar questões pessoais das profissionais.',
      '{nome} demonstra equilíbrio emocional em situações de pressão.',
      '{nome} contribui para um ambiente de trabalho positivo.',
      'Eu me sinto à vontade para levar um problema ou uma ideia para {nome}.']},
    {nome:'Organização e gestão', perguntas:[
      '{nome} demonstra organização na condução das atividades.',
      '{nome} distribui as responsabilidades de maneira justa.',
      '{nome} acompanha e orienta a execução das tarefas.',
      '{nome} resolve os problemas da academia de maneira rápida e eficiente.',
      '{nome} assume a responsabilidade quando algo não sai como o esperado.',
      '{nome} me dá o que eu preciso para fazer bem o meu trabalho: orientação, materiais e acesso ao sistema.']},
    {nome:'Resolução de conflitos', perguntas:[
      '{nome} age com imparcialidade diante de conflitos.',
      '{nome} ouve todos os envolvidos antes de tomar uma decisão.',
      '{nome} resolve problemas sem expor ou constranger os colaboradores.',
      '{nome} sabe lidar com situações de desentendimento.',
      '{nome} busca soluções em vez de procurar culpados.']},
    {nome:'Desenvolvimento e motivação', perguntas:[
      '{nome} reconhece o esforço e os resultados da equipe.',
      '{nome} demonstra interesse pelo crescimento profissional dos colaboradores.',
      '{nome} dá feedbacks construtivos.',
      '{nome} motiva a equipe a alcançar melhores resultados.',
      '{nome} faz os colaboradores se sentirem valorizados.']}
  ],
  nps:'De 0 a 10, quanto você indicaria {nome} como gerente para um amigo que viesse trabalhar aqui?',
  abertas:[
    'Na sua opinião, qual é a maior qualidade de {nome}?',
    'O que {nome} precisa melhorar como líder?',
    'Você se sente confortável para conversar com {nome} quando tem algum problema? Por quê?',
    'Existe alguma atitude de {nome} que prejudica o relacionamento ou o desempenho da equipe?',
    'O que você gostaria que {nome} fizesse diferente para melhorar o ambiente de trabalho?',
    'Se pudesse dar um conselho a {nome} para melhorar a liderança, qual seria?',
    'Mais alguma coisa que a direção precisa saber?']
},
{
  id:'recepcao', nome:'Recepção', funcao:'recepcao', publico:'equipe',
  desc:'Atendimento, rotina do turno, retenção de alunos e postura.',
  quem:'Nome da recepcionista',
  blocos:[
    {nome:'Atendimento', perguntas:[
      '{nome} recebe os alunos e os visitantes com simpatia e pelo nome.',
      '{nome} responde o WhatsApp e o telefone da academia com rapidez.',
      '{nome} resolve as dúvidas dos alunos com segurança, sem empurrar para outra pessoa.',
      '{nome} mantém a calma e a educação com alunos difíceis ou reclamando.']},
    {nome:'Rotina e organização', perguntas:[
      '{nome} mantém o cadastro dos alunos atualizado no sistema.',
      '{nome} faz a abertura e o fechamento do turno sem deixar pendências.',
      '{nome} cuida do caixa e dos recebimentos com atenção e sem erros.',
      '{nome} mantém a recepção limpa e organizada.']},
    {nome:'Relacionamento e retenção', perguntas:[
      '{nome} entra em contato com os alunos ausentes e com os aniversariantes.',
      '{nome} cobra os alunos inadimplentes com respeito e firmeza.',
      '{nome} pede indicações e incentiva os alunos a trazer amigos.',
      '{nome} registra o que fez no relatório do turno.']},
    {nome:'Postura e trabalho em equipe', perguntas:[
      '{nome} chega no horário e cumpre a escala.',
      '{nome} não usa o celular pessoal durante o atendimento.',
      '{nome} passa as informações do turno para quem chega depois.',
      '{nome} ajuda os colegas quando a recepção está cheia.']}
  ],
  nps:'De 0 a 10, quanto você recomendaria o atendimento de {nome}?',
  abertas:[
    'O que {nome} faz muito bem no atendimento?',
    'O que {nome} precisa melhorar?',
    'Tem alguma situação que a direção precisa saber?']
},
{
  id:'musculacao', nome:'Professor de musculação', funcao:'musculacao', publico:'alunos',
  desc:'Atenção na sala, técnica e segurança, treinos e retenção.',
  quem:'Nome do professor',
  blocos:[
    {nome:'Atendimento na sala', perguntas:[
      '{nome} circula pela sala e se aproxima dos alunos sem esperar ser chamado.',
      '{nome} cumprimenta os alunos e sabe o nome da maioria deles.',
      '{nome} dá atenção a todos, não só aos alunos mais próximos.',
      '{nome} recebe bem os alunos novos e explica como a sala funciona.']},
    {nome:'Técnica e segurança', perguntas:[
      '{nome} corrige a execução dos exercícios quando vê algo errado.',
      '{nome} explica o porquê dos exercícios de um jeito fácil de entender.',
      '{nome} se preocupa com a segurança: carga, postura e uso correto dos aparelhos.',
      '{nome} demonstra conhecimento técnico atualizado.']},
    {nome:'Treinos e resultados', perguntas:[
      '{nome} monta e atualiza os treinos dentro do prazo.',
      'O treino montado por {nome} combina com o objetivo do aluno.',
      '{nome} acompanha a evolução dos alunos e faz as reavaliações.']},
    {nome:'Postura e organização', perguntas:[
      '{nome} chega no horário e cumpre a escala.',
      '{nome} não fica no celular durante o horário de trabalho.',
      '{nome} mantém a sala organizada: anilhas, halteres e acessórios no lugar.',
      '{nome} trata colegas e alunos com respeito.']},
    {nome:'Retenção', perguntas:[
      '{nome} percebe quando um aluno está sumindo e avisa a recepção.',
      '{nome} motiva os alunos a manter a frequência.']}
  ],
  nps:'De 0 a 10, quanto você indicaria {nome} como professor para um amigo?',
  abertas:[
    'O que você mais gosta no atendimento de {nome}?',
    'O que {nome} poderia fazer melhor na sala?',
    'Mais alguma coisa que a direção precisa saber?']
},
{
  id:'coletivas', nome:'Professor de aulas coletivas', funcao:'coletivas', publico:'alunos', modalidade:true,
  desc:'Escolha a modalidade: spinning, jump, ritmos, pilates, lutas e outras.',
  quem:'Nome do professor',
  blocos:[
    {nome:'Planejamento da aula', perguntas:[
      'As aulas de {modalidade} com {nome} são bem planejadas, com começo, meio e fim.',
      '{nome} começa e termina a aula no horário.',
      '{nome} varia as aulas e não deixa cair na rotina.',
      'A música e o ritmo combinam com a proposta da aula.']},
    {nome:'Condução e técnica', perguntas:[
      '{nome} explica e demonstra os movimentos com clareza.',
      '{nome} dá opções mais leves e mais intensas para cada nível.',
      '{nome} corrige a postura dos alunos durante a aula.',
      '{nome} cuida da segurança de quem está na aula.']},
    {nome:'Energia e motivação', perguntas:[
      '{nome} chega com energia e anima a turma.',
      'Eu saio da aula com vontade de voltar.',
      '{nome} incentiva os alunos a trazer amigos para a aula.']},
    {nome:'Relacionamento', perguntas:[
      '{nome} conhece os alunos pelo nome.',
      '{nome} recebe bem quem está fazendo a aula pela primeira vez.',
      '{nome} dá atenção a todos da turma, sem preferências.']},
    {nome:'Organização', perguntas:[
      'O material da aula está pronto antes de começar e é guardado no final.',
      '{nome} avisa com antecedência quando a aula muda ou é cancelada.']}
  ],
  nps:'De 0 a 10, quanto você indicaria a aula de {modalidade} com {nome} para um amigo?',
  abertas:[
    'O que você mais gosta nessa aula?',
    'O que poderia melhorar?',
    'Que horário ou aula nova você gostaria que a academia tivesse?']
},
{
  id:'limpeza', nome:'Limpeza', funcao:'limpeza', publico:'equipe',
  desc:'Banheiros, aparelhos, salas, rotina e uso de material.',
  quem:'Nome de quem faz a limpeza',
  blocos:[
    {nome:'Banheiros e vestiários', perguntas:[
      'Os banheiros e vestiários ficam limpos durante todo o turno de {nome}.',
      'Papel, sabonete e álcool em gel não faltam no turno de {nome}.',
      'O lixo é retirado antes de encher.']},
    {nome:'Musculação e aparelhos', perguntas:[
      'Os aparelhos e os bancos são higienizados com frequência.',
      'O chão da sala de musculação fica limpo e sem poeira.',
      'Os espelhos e os vidros ficam limpos.']},
    {nome:'Salas de aula e áreas comuns', perguntas:[
      'As salas de aula coletiva ficam limpas antes de cada aula.',
      'A recepção, a entrada e os bebedouros ficam limpos.',
      'Os colchonetes, tapetes e acessórios são higienizados.']},
    {nome:'Rotina e postura', perguntas:[
      '{nome} cumpre a rotina e o checklist de limpeza do turno.',
      '{nome} chega no horário e cumpre a escala.',
      '{nome} avisa quando falta material ou algo está quebrado.',
      '{nome} usa os produtos do jeito certo, sem desperdício.',
      '{nome} trata alunos e colegas com educação.']}
  ],
  nps:'De 0 a 10, que nota você dá para a limpeza da academia no turno de {nome}?',
  abertas:[
    'Qual lugar da academia mais precisa de atenção na limpeza?',
    'O que {nome} faz muito bem?',
    'Mais alguma coisa?']
},
{
  id:'vendas', nome:'Vendas (consultor)', funcao:'vendas', publico:'gestor',
  desc:'Atendimento ao visitante, negociação, fechamento e follow-up.',
  quem:'Nome do consultor',
  blocos:[
    {nome:'Atendimento ao visitante', perguntas:[
      '{nome} recebe os visitantes rápido, sem deixar ninguém esperando.',
      '{nome} entende o objetivo do visitante antes de falar de preço.',
      '{nome} apresenta a academia com orgulho e mostra a estrutura toda.',
      '{nome} agenda e acompanha a aula experimental.']},
    {nome:'Negociação e fechamento', perguntas:[
      '{nome} conhece bem todos os planos, preços e condições.',
      '{nome} contorna as objeções sem pressionar demais o cliente.',
      '{nome} pede o fechamento na hora certa.',
      '{nome} oferece o plano que faz sentido para o cliente, não só o mais caro.']},
    {nome:'Follow-up e metas', perguntas:[
      '{nome} retorna para quem visitou e não fechou.',
      '{nome} registra todos os contatos e oportunidades no sistema.',
      '{nome} cumpre as metas diárias de contatos e agendamentos.',
      '{nome} pede indicações para quem acabou de se matricular.']},
    {nome:'Pós-venda e postura', perguntas:[
      '{nome} faz o aluno novo se sentir bem-vindo nas primeiras semanas.',
      '{nome} passa informações corretas, sem prometer o que a academia não entrega.',
      '{nome} chega no horário e mantém uma postura profissional.',
      '{nome} trabalha em equipe com a recepção e os professores.']}
  ],
  nps:'De 0 a 10, quanto você confia em {nome} para atender um cliente importante?',
  abertas:[
    'Qual é o ponto forte de {nome} em vendas?',
    'Onde {nome} está perdendo vendas?',
    'Mais alguma coisa?']
},
{
  id:'comercial', nome:'Comercial (coordenação)', funcao:'comercial', publico:'gestor',
  desc:'Parcerias, campanhas, marketing local, funil e metas.',
  quem:'Nome do responsável comercial',
  blocos:[
    {nome:'Prospecção e parcerias', perguntas:[
      '{nome} prospecta empresas e parceiros de forma constante.',
      '{nome} fecha parcerias e convênios que trazem alunos de verdade.',
      '{nome} mantém o relacionamento com os parceiros depois do fechamento.']},
    {nome:'Campanhas e marketing local', perguntas:[
      '{nome} planeja as campanhas e ações do mês com antecedência.',
      '{nome} acompanha o resultado das campanhas e corrige o que não funciona.',
      '{nome} usa o Instagram e o WhatsApp da academia para gerar oportunidades.',
      '{nome} organiza ações externas e eventos que trazem visitantes.']},
    {nome:'Funil e metas', perguntas:[
      '{nome} conhece os números do mês: visitas, matrículas, cancelamentos e conversão.',
      '{nome} acompanha a equipe de vendas e a recepção no cumprimento das metas.',
      '{nome} identifica onde o funil está perdendo clientes.',
      '{nome} entrega os relatórios comerciais no prazo.']},
    {nome:'Liderança e postura', perguntas:[
      '{nome} treina e orienta quem vende.',
      '{nome} cobra resultados com respeito e clareza.',
      '{nome} traz ideias novas para aumentar as vendas.',
      '{nome} cumpre os combinados com a direção.']}
  ],
  nps:'De 0 a 10, quanto o trabalho de {nome} está ajudando a academia a crescer?',
  abertas:[
    'Qual foi a maior entrega de {nome} até agora?',
    'O que {nome} precisa melhorar?',
    'Que oportunidade comercial a academia está perdendo?']
},
{
  id:'coordenador', nome:'Coordenador técnico', funcao:'coordenador', publico:'equipe',
  desc:'Gestão dos professores, padrão técnico, grade de aulas e liderança.',
  quem:'Nome do coordenador',
  blocos:[
    {nome:'Gestão da equipe técnica', perguntas:[
      '{nome} organiza a escala dos professores sem deixar a sala descoberta.',
      '{nome} acompanha o trabalho dos professores na sala e nas aulas.',
      '{nome} dá feedback e orientação técnica para a equipe.',
      '{nome} treina os professores novos e os estagiários.']},
    {nome:'Padrão técnico', perguntas:[
      '{nome} define um padrão de montagem de treino e cobra que seja seguido.',
      '{nome} garante que as avaliações físicas e reavaliações sejam feitas.',
      '{nome} demonstra conhecimento técnico atualizado.']},
    {nome:'Grade de aulas e estrutura', perguntas:[
      '{nome} monta uma grade de aulas coletivas que atende os alunos.',
      '{nome} resolve rápido a falta de um professor.',
      '{nome} cuida da conservação e da organização dos equipamentos junto com a direção.']},
    {nome:'Liderança', perguntas:[
      '{nome} dá o exemplo de pontualidade e postura.',
      '{nome} trata todos os professores com respeito e sem favorecimentos.',
      'Eu me sinto à vontade para levar um problema para {nome}.']}
  ],
  nps:'De 0 a 10, quanto você indicaria {nome} como coordenador para um colega professor?',
  abertas:[
    'Qual é a maior qualidade de {nome}?',
    'O que {nome} precisa melhorar como coordenador?',
    'Mais alguma coisa que a direção precisa saber?']
},
{
  id:'personal', nome:'Personal trainer', funcao:'personal', publico:'alunos',
  desc:'Para os alunos avaliarem o personal: sessões, resultado e postura.',
  quem:'Nome do personal',
  blocos:[
    {nome:'Sessões', perguntas:[
      '{nome} chega no horário e não remarca as sessões sem necessidade.',
      '{nome} planeja as sessões de acordo com o meu objetivo.',
      '{nome} corrige a execução e cuida da minha segurança.',
      '{nome} fica 100% focado em mim durante a sessão, sem celular.']},
    {nome:'Resultado', perguntas:[
      '{nome} mede a minha evolução e me mostra os resultados.',
      'Estou tendo o resultado que esperava com {nome}.',
      '{nome} me motiva a não faltar.']},
    {nome:'Postura na academia', perguntas:[
      '{nome} segue as regras da academia.',
      '{nome} respeita os outros alunos e divide bem os aparelhos.']}
  ],
  nps:'De 0 a 10, quanto você indicaria {nome} como personal para um amigo?',
  abertas:[
    'O que você mais gosta no trabalho de {nome}?',
    'O que poderia melhorar?']
},
{
  id:'estagiario', nome:'Estagiário', funcao:'estagiario', publico:'gestor',
  desc:'Aprendizado, atendimento na sala e postura.',
  quem:'Nome do estagiário',
  blocos:[
    {nome:'Aprendizado', perguntas:[
      '{nome} tem vontade de aprender e faz perguntas.',
      '{nome} aplica as orientações que recebe.',
      '{nome} aceita bem as correções.']},
    {nome:'Atendimento na sala', perguntas:[
      '{nome} se aproxima dos alunos e oferece ajuda.',
      '{nome} corrige a execução dos exercícios com segurança.',
      '{nome} sabe quando chamar o professor responsável.']},
    {nome:'Postura', perguntas:[
      '{nome} chega no horário e cumpre a escala.',
      '{nome} não fica no celular durante o horário de trabalho.',
      '{nome} mantém a sala organizada.',
      '{nome} trata alunos e colegas com respeito.']}
  ],
  nps:'De 0 a 10, quanto você contrataria {nome} como professor no futuro?',
  abertas:[
    'Qual é o ponto forte de {nome}?',
    'O que {nome} precisa desenvolver?']
},
{
  id:'manutencao', nome:'Manutenção', funcao:'manutencao', publico:'gestor',
  desc:'Aparelhos, estrutura, prevenção e postura.',
  quem:'Nome do responsável pela manutenção',
  blocos:[
    {nome:'Aparelhos', perguntas:[
      'Os aparelhos quebrados são consertados rápido.',
      '{nome} faz a manutenção preventiva (cabos, estofados, esteiras e bikes) sem esperar quebrar.',
      '{nome} avisa a direção quando precisa comprar peça ou chamar um técnico.']},
    {nome:'Estrutura', perguntas:[
      'O ar-condicionado, a iluminação e o som funcionam bem.',
      'Os vestiários, chuveiros e descargas funcionam bem.',
      '{nome} deixa o local limpo e organizado depois do serviço.']},
    {nome:'Postura', perguntas:[
      '{nome} cumpre os horários combinados.',
      '{nome} trata alunos e colegas com educação.']}
  ],
  nps:'De 0 a 10, como está a conservação da academia hoje?',
  abertas:[
    'O que mais precisa de conserto ou atenção agora?',
    'Mais alguma coisa?']
},
{
  id:'alunos', nome:'Satisfação dos alunos', funcao:'alunos', publico:'alunos', academia:true,
  desc:'Pesquisa com os alunos sobre a academia inteira, com NPS.',
  quem:'Nome da academia',
  blocos:[
    {nome:'Atendimento', perguntas:[
      'Sou bem atendido na recepção.',
      'Os professores da musculação me dão atenção.',
      'Consigo resolver minhas dúvidas e problemas com facilidade.']},
    {nome:'Estrutura', perguntas:[
      'Os aparelhos estão em bom estado e funcionando.',
      'A academia está sempre limpa, inclusive banheiros e vestiários.',
      'A temperatura, a iluminação e a música são agradáveis.',
      'Encontro aparelho livre nos horários em que treino.']},
    {nome:'Aulas coletivas', perguntas:[
      'A grade de aulas tem horários que me atendem.',
      'As aulas coletivas são boas.']},
    {nome:'Resultado e valor', perguntas:[
      'Estou tendo resultado com o meu treino.',
      'O preço é justo pelo que a academia entrega.',
      'Me sinto parte da comunidade da academia.']}
  ],
  nps:'De 0 a 10, quanto você indicaria a {nome} para um amigo ou familiar?',
  abertas:[
    'O que você mais gosta na academia?',
    'O que mais te incomoda?',
    'O que faria você treinar mais vezes?',
    'Você já pensou em cancelar? Se sim, por quê?']
},
{
  id:'clima', nome:'Clima da equipe', funcao:'clima', publico:'equipe', academia:true,
  desc:'Pesquisa interna: ambiente, clareza, reconhecimento e liderança.',
  quem:'Nome da academia',
  blocos:[
    {nome:'Ambiente', perguntas:[
      'Gosto de trabalhar na {nome}.',
      'O clima entre os colegas é bom.',
      'Me sinto respeitado no meu trabalho.']},
    {nome:'Clareza', perguntas:[
      'Sei exatamente o que é esperado de mim.',
      'As metas são claras e possíveis de bater.',
      'Recebo as informações a tempo.']},
    {nome:'Reconhecimento e crescimento', perguntas:[
      'Meu esforço é reconhecido.',
      'A comissão e o salário são justos pelo trabalho que faço.',
      'Vejo chance de crescer aqui.']},
    {nome:'Estrutura de trabalho', perguntas:[
      'Tenho o que preciso para trabalhar bem: sistema, material e uniforme.',
      'A escala de horários é justa.']},
    {nome:'Liderança', perguntas:[
      'Confio na liderança da academia.',
      'Posso dar minha opinião sem medo.']}
  ],
  nps:'De 0 a 10, quanto você indicaria a {nome} como lugar para trabalhar?',
  abertas:[
    'O que faria você trabalhar mais feliz aqui?',
    'O que te faria sair da academia?',
    'Uma ideia para melhorar a academia.']
}
];
