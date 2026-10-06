"""Gera somente arquivos importáveis locais; nunca grava no Firebase."""
import json
from pathlib import Path

original = '''Am frühen Morgen gehe ich zum See.
Über dem Wasser liegt leichter Nebel.
Ich höre die Vögel und bleibe einen Moment stehen.
Die Luft ist kühl, aber die Sonne scheint schon.
Am Ufer sehe ich einen kleinen Vogel.
Er sitzt auf einem Ast und schaut ins Wasser.
Nach einer Weile gehe ich langsam zum Haus zurück.
Dort mache ich mir einen Kaffee.
Ich sitze am Fenster und denke an den Tag.
Heute möchte ich im Garten arbeiten.'''.splitlines()
secoes = {s: [] for s in ['duvidas','blocos','sentencas','substantivos','verbos','adjetivos','adverbios']}
def item(s, de, pt, linha=None):
    i = dict(de=de, pt=pt, essencial=s in ['duvidas','blocos'])
    if linha is not None: i['origem'] = original[linha]
    secoes[s].append(i)
for de,pt,n in [
    ('schaut','olha; infinitivo schauen',5),
    ('die Weile / nach einer Weile','algum tempo / depois de algum tempo. Weile = algum tempo; Luft = ar.',6),
    ('die Luft','ar. Luft = ar; Weile = algum tempo.',3)]: item('duvidas',de,pt,n)
for de,pt,n in [
    ('am frühen Morgen','bem cedo, pela manhã',0),
    ('einen Moment stehen bleiben','ficar parado por um momento, em pé',2),
    ('nach einer Weile','depois de algum tempo',6),
    ('zum Haus zurückgehen','voltar para a casa',6),
    ('an den Tag denken','pensar no dia',8)]: item('blocos',de,pt,n)
for n,pt in [(0,'Bem cedo, vou ao lago.'),(3,'O ar está fresco, mas o sol já brilha.'),(9,'Hoje gostaria de trabalhar no jardim.')]: item('sentencas',original[n],pt,n)
for de,pt in [
    ('der Morgen; die Morgen','manhã'),('der See; die Seen','lago'),('das Wasser; —','água (sem plural neste uso)'),
    ('der Nebel; die Nebel','neblina'),('die Luft; —','ar (sem plural neste uso)'),('das Ufer; die Ufer','margem'),
    ('der Vogel; die Vögel','pássaro'),('der Ast; die Äste','galho'),('die Weile; die Weilen','algum tempo / intervalo de tempo'),
    ('das Fenster; die Fenster','janela'),('der Garten; die Gärten','jardim')]: item('substantivos',de,pt)
for de,pt in [
    ('gehe; gehen','ir'),('liegt; liegen','pairar sobre a água, neste contexto'),('höre; hören','ouvir'),
    ('bleibe … stehen; stehen bleiben','parar / ficar parado, em pé'),('scheint; scheinen','brilhar'),('sehe; sehen','ver'),
    ('sitzt / sitze; sitzen','estar sentado'),('schaut; schauen','olhar'),('gehe … zurück; zurückgehen','voltar'),
    ('mache … einen Kaffee; machen','preparar um café'),('denke; denken','pensar'),('möchte; mögen','gostaria de (forma de Konjunktiv II)'),('arbeiten; arbeiten','trabalhar')]: item('verbos',de,pt)
for de,pt in [('frühen','cedo, em “am frühen Morgen”'),('leichter','leve, em “leichter Nebel”'),('kühl','fresco'),('kleinen','pequeno, em “einen kleinen Vogel”')]: item('adjetivos',de,pt)
for de,pt in [('schon','já'),('langsam','devagar'),('dort','lá'),('heute','hoje'),('zurück','de volta, aqui parte de zurückgehen')]: item('adverbios',de,pt)
out=Path(__file__).resolve().parents[1]/'webapp/cards'
card=dict(versao=1,numero=1,titulo='Ein Morgen auf dem Land',secoes=secoes)
(out/'texto-01.json').write_text(json.dumps(card,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
modelo=dict(versao=1,numero=2,titulo='Título do próximo texto',secoes={s:[] for s in secoes})
for s in ['duvidas','blocos']: modelo['secoes'][s]=[dict(de='Trecho alemão',pt='Sentido em português',origem='Frase copiada exatamente do original escolhido.',essencial=True)]
(out/'modelo.json').write_text(json.dumps(modelo,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
