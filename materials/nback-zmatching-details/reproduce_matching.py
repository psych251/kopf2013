from pathlib import Path
import pandas as pd
import numpy as np
from scipy.optimize import linear_sum_assignment
import json

ROOT=Path(__file__).resolve().parent
b=pd.read_excel(ROOT/'upload/BAWL-R.xlsx')
e=pd.read_csv(ROOT/'upload/BRM-emot-submit.csv')
# Manually vetted nouns with six letters. Phones use a consistent American-English
# ARPABET-style convention (ER is one rhotic vowel; affricates are single phones).
# These are manual transcriptions, not dictionary verification.
phones='''
heaven HH EH V AH N
beauty B Y UW T IY
cuddle K AH D AH L
rabbit R AE B AH T
couple K AH P AH L
guitar G IH T AA R
riches R IH CH IH Z
sundae S AH N D EY
kitten K IH T AH N
giggle G IH G AH L
sister S IH S T ER
nectar N EH K T ER
orchid AO R K AH D
silver S IH L V ER
yogurt Y OW G ER T
waffle W AA F AH L
ribbon R IH B AH N
helper HH EH L P ER
dancer D AE N S ER
nephew N EH F Y UW
parrot P AE R AH T
orange AO R AH N JH
encore AA N K AO R
muffin M AH F AH N
safety S EY F T IY
island AY L AH N D
relief R IH L IY F
design D IH Z AY N
wonder W AH N D ER
future F Y UW CH ER
access AE K S EH S
entree AA N T R EY
medley M EH D L IY
season S IY Z AH N
vision V IH ZH AH N
poison P OY Z AH N
coffin K AO F AH N
damage D AE M IH JH
malice M AE L IH S
orphan AO R F AH N
duress D UH R EH S
demise D IH M AY Z
dismay D IH S M EY
maggot M AE G AH T
trauma T R AO M AH
cancer K AE N S ER
herpes HH ER P IY Z
hijack HH AY JH AE K
mayhem M EY HH EH M
rabies R EY B IY Z
vermin V ER M AH N
canker K AE NG K ER
mildew M IH L D UW
danger D EY N JH ER
inmate IH N M EY T
napalm N EY P AA M
famine F AE M AH N
pileup P AY L AH P
addict AE D IH K T
deceit D IH S IY T
hazard HH AE Z ER D
lesion L IY ZH AH N
hassle HH AE S AH L
menace M EH N AH S
manure M AH N UH R
hunger HH AH NG G ER
spider S P AY D ER
bullet B UH L AH T
battle B AE T AH L
zombie Z AA M B IY
python P AY TH AA N
burden B ER D AH N
typhus T AY F AH S
bucket B AH K IH T
mallet M AE L IH T
pallet P AE L IH T
docket D AA K IH T
kennel K EH N AH L
pellet P EH L IH T
cannon K AE N AH N
cocoon K AH K UW N
deacon D IY K AH N
beacon B IY K AH N
bottle B AA T AH L
button B AH T AH N
buckle B AH K AH L
fiddle F IH D AH L
middle M IH D AH L
paddle P AE D AH L
border B AO R D ER
corner K AO R N ER
barber B AA R B ER
tanker T AE NG K ER
banker B AE NG K ER
bunker B AH NG K ER
kernel K ER N AH L
sermon S ER M AH N
tassel T AE S AH L
filter F IH L T ER
binder B AY N D ER
jumper JH AH M P ER
sensor S EH N S ER
roster R AA S T ER
bonnet B AA N IH T
column K AA L AH M
packet P AE K IH T
saddle S AE D AH L
vessel V EH S AH L
ticket T IH K IH T
shovel SH AH V AH L
funnel F AH N AH L
barrel B AE R AH L
thesis TH IY S IH S
budget B AH JH IH T
dosage D OW S IH JH
escrow EH S K R OW
vector V EH K T ER
buster B AH S T ER
turnip T ER N AH P
rating R EY T IH NG
sector S EH K T ER
ration R AE SH AH N
quarry K W AO R IY
runway R AH N W EY
tycoon T AY K UW N
decade D EH K EY D
condor K AA N D ER
rabble R AE B AH L
bumper B AH M P ER
lawman L AO M AE N
offset AO F S EH T
cinder S IH N D ER
clergy K L ER JH IY
sinker S IH NG K ER
output AW T P UH T
copter K AA P T ER
vassal V AE S AH L
duffel D AH F AH L
factor F AE K T ER
kidney K IH D N IY
module M AA JH UW L
photon F OW T AA N
timber T IH M B ER
barley B AA R L IY
repose R IH P OW Z
retail R IY T EY L
domain D OW M EY N
gender JH EH N D ER
jigsaw JH IH G S AO
tracer T R EY S ER
wiring W AY R IH NG
figure F IH G Y ER
novice N AA V IH S
fender F EH N D ER
intern IH N T ER N
hamper HH AE M P ER
gaggle G AE G AH L
holder HH OW L D ER
county K AW N T IY
gerbil JH ER B AH L
method M EH TH AH D
camper K AE M P ER
makeup M EY K AH P
ravine R AH V IY N
region R IY JH AH N
shaman SH EY M AH N
series S IH R IY Z
chisel CH IH Z AH L
duster D AH S T ER
permit P ER M IH T
seaman S IY M AH N
ballot B AE L AH T
cherub CH EH R AH B
vendor V EH N D ER
huddle HH AH D AH L
legion L IY JH AH N
motive M OW T IH V
decree D IH K R IY
fennel F EH N AH L
pastor P AE S T ER
poster P OW S T ER
primer P R AY M ER
desert D EH Z ER T
junior JH UW N Y ER
clover K L OW V ER
hairdo HH EH R D UW
raffle R AE F AH L
skewer S K Y UW ER
cavern K AE V ER N
grocer G R OW S ER
convoy K AA N V OY
sander S AE N D ER
tennis T EH N IH S
cattle K AE T AH L
remote R IH M OW T
treaty T R IY T IY
veneer V AH N IH R
nuance N UW AA N S
trader T R EY D ER
banter B AE N T ER
engine EH N JH AH N
poncho P AA N CH OW
refill R IY F IH L
alcove AE L K OW V
blazer B L EY Z ER
escape IH S K EY P
kibble K IH B AH L
manger M EY N JH ER
minute M IH N IH T
summit S AH M IH T
winter W IH N T ER
'''
manual=[]
for l in phones.strip().splitlines():
 w,*p=l.split()
 assert len(w)==6 and len(p)==5,(w,p)
 assert sum(ph in set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split()) for ph in p)==2,(w,p)
 manual.append({'word':w,'manual_pronunciation':' '.join(p),'letters':6,'phonemes':5,'syllables':2})
manual=pd.DataFrame(manual)
assert not manual.word.duplicated().any()
# Full-database standardization: one mean/SD for each dimension in each language.
norm=[]
for database,df,cols in [('BAWL-R',b,{'valence':'EMO_MEAN','arousal':'AROUSAL_MEAN'}),('Warriner',e,{'valence':'V.Mean.Sum','arousal':'A.Mean.Sum'})]:
 for dim,col in cols.items():
  mean=float(df[col].mean());sd=float(df[col].std(ddof=1))
  norm.append(dict(database=database,dimension=dim,n=int(df[col].count()),mean=mean,sd=sd,sd_ddof=1))
  df[dim+'_z']=(df[col]-mean)/sd
norm=pd.DataFrame(norm)
e=e.rename(columns={'Word':'word','V.Mean.Sum':'valence','A.Mean.Sum':'arousal'})
candidates=manual.merge(e[['word','valence','arousal','valence_z','arousal_z']],on='word',how='inner')
missing=sorted(set(manual.word)-set(candidates.word))
print('Manual pool',len(manual),'in Warriner',len(candidates),'missing',missing)
sets={'negative':'TYPHUS BEFEHL ARREST TYRANN GREUEL SEENOT HORROR TRAUMA TERROR UNHEIL'.split(),'positive':'RETTER WISSEN MUTTER GEWINN GEFÜHL HIMMEL FRIEDE URLAUB SOMMER FREUND'.split(),'neutral':'ABLAUF AFFEKT BANNER GERUCH KELLER LOSUNG STELLE ZEUGIN AKZENT INHALT'.split()}
original=[]
for cat,ws in sets.items():
 for w in ws:
  row=b.loc[b.WORD==w]
  assert len(row)==1,(w,len(row))
  r=row.iloc[0]
  original.append(dict(category=cat,german_word=w,german_valence=float(r.EMO_MEAN),german_arousal=float(r.AROUSAL_MEAN),german_valence_z=float(r.valence_z),german_arousal_z=float(r.arousal_z),german_letters=int(r.LETTERS),german_phonemes=float(r.PHONEMES),german_syllables=int(r.SYLLABLES)))
original=pd.DataFrame(original)

def match(targets,pool):
 a=targets[['german_valence_z','german_arousal_z']].to_numpy()
 c=pool[['valence_z','arousal_z']].to_numpy()
 cost=((a[:,None,:]-c[None,:,:])**2).sum(axis=2)
 ii,jj=linear_sum_assignment(cost)
 out=[]
 for i,j in zip(ii,jj):
  d={**targets.iloc[i].to_dict(),**pool.iloc[j].to_dict()}
  d['delta_valence_z']=d['valence_z']-d['german_valence_z']
  d['delta_arousal_z']=d['arousal_z']-d['german_arousal_z']
  d['match_distance_z']=float(np.sqrt(cost[i,j]))
  out.append(d)
 return pd.DataFrame(out)

selected=[]
for cat in sets:
 if cat=='negative':pool=candidates[candidates.valence<=4.0]
 elif cat=='positive':pool=candidates[candidates.valence>=6.5]
 else:pool=candidates[candidates.valence.between(4.5,5.5)]
 print(cat,'eligible pool',len(pool))
 selected.append(match(original[original.category==cat].reset_index(drop=True),pool.reset_index(drop=True)))
selected=pd.concat(selected,ignore_index=True)
neutral=original[original.category=='neutral'].reset_index(drop=True)
practice_targets=pd.concat([neutral.assign(practice_reference_repeat=i+1) for i in range(3)],ignore_index=True)
practice_pool=candidates[candidates.valence.between(4.5,5.5)&~candidates.word.isin(selected.word)].reset_index(drop=True)
practice=match(practice_targets,practice_pool)
assert len(selected)==30 and len(practice)==30
assert selected.word.nunique()==30 and practice.word.nunique()==30
assert not set(selected.word)&set(practice.word)
for d in [selected,practice]:
 assert (d.letters==6).all() and (d.phonemes==5).all() and (d.syllables==2).all()
print('\nMAIN')
print(selected[['category','german_word','word','valence','arousal','valence_z','arousal_z','match_distance_z']].round(3).to_string(index=False))
print('\nPRACTICE')
print(practice[['word','valence','arousal','valence_z','arousal_z','match_distance_z']].round(3).to_string(index=False))

outdir=ROOT/'results';outdir.mkdir(exist_ok=True)
for name,d in [('experiment',selected),('practice',practice),('german_original',original),('normalization',norm),('candidate_pool',candidates)]:
 d.to_csv(outdir/(name+'.csv'),index=False)
full_b=b.rename(columns={'WORD':'word','EMO_MEAN':'valence','AROUSAL_MEAN':'arousal'})
pd.concat([e[['word','valence','arousal','valence_z','arousal_z']].assign(database='Warriner'),full_b[['word','valence','arousal','valence_z','arousal_z']].assign(database='BAWL-R')]).to_csv(outdir/'full_database_zscores.csv',index=False)
print('\nSUMMARIES')
for cat in sets:
 orig=original[original.category==cat]
 sel=selected[selected.category==cat]
 print(cat,'german z',orig[['german_valence_z','german_arousal_z']].mean().round(4).to_dict(),'english z',sel[['valence_z','arousal_z']].mean().round(4).to_dict(),'mean match distance',sel.match_distance_z.mean())
print('practice mean z',practice[['valence_z','arousal_z']].mean().round(4).to_dict())
