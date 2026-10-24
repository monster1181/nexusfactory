import json,sys,re,os
sys.path.insert(0,os.path.dirname(__file__))
from es import ITEMS,ALTS,MACHINES
d=json.load(open(sys.argv[1] if len(sys.argv)>1 else 'data1.0.json'))
I,R,B=d['items'],d['recipes'],d['buildings']
def sid(k): return re.sub(r'^(Desc_|BP_ItemDescriptor|BP_EquipmentDescriptor|BP_)','',k).removesuffix('_C')
SLOTS={'Desc_ConstructorMk1_C':1,'Desc_SmelterMk1_C':1,'Desc_FoundryMk1_C':2,'Desc_AssemblerMk1_C':2,'Desc_OilRefinery_C':2,
 'Desc_ManufacturerMk1_C':4,'Desc_Blender_C':4,'Desc_HadronCollider_C':4,'Desc_QuantumEncoder_C':4,'Desc_Converter_C':2,'Desc_Packager_C':0}
missing=set()
def es_item(n):
    if n in ITEMS: return ITEMS[n]
    missing.add(n); return n
def es_recipe(n,alt):
    if alt:
        b=n.replace('Alternate: ','')
        if b in ALTS: return ALTS[b]
        missing.add('ALT:'+b); return b
    if n in ITEMS: return ITEMS[n]
    m=re.match(r'^(.*) \((.*)\)$',n)
    if m:
        a,b=m.groups(); return f"{es_item(a)} ({ITEMS.get(b,b)})"
    if n.startswith('Unpackage '): return 'Desempaquetar '+es_item(n[10:]).lower()
    if n.startswith('Residual '): return es_item(n[9:])+' residual'
    missing.add('REC:'+n); return n
items={};recipes=[];machines={};used=set()
def liq(k): return I[k]['liquid']
for k,r in R.items():
    if not(r['inMachine'] and r['producedIn']): continue
    m=r['producedIn'][0]
    conv=lambda l:[[sid(x['item']), x['amount']] for x in l]
    rec={'id':sid(k).removeprefix('Recipe_'),'n':r['name'].replace('Alternate: ',''),'ne':es_recipe(r['name'],r['alternate']),
         'alt':1 if r['alternate'] else 0,'t':r['time'],'m':sid(m),'in':conv(r['ingredients']),'out':conv(r['products'])}
    if r['isVariablePower']: rec['pw']=[r['minPower'],r['maxPower']]
    recipes.append(rec)
    for x in r['ingredients']+r['products']: used.add(x['item'])
    if sid(m) not in machines:
        b=B[m]; machines[sid(m)]={'n':b['name'],'ne':MACHINES.get(b['name'],b['name']),'p':b['metadata']['powerConsumption'],'s':SLOTS[m]}
used|=set(d['resources'])
for g in d['generators'].values(): used|=set(g['fuel'])
for k in used:
    it=I[k]
    items[sid(k)]=[it['name'],es_item(it['name']),1 if it['liquid'] else 0,it['sinkPoints'],it['energyValue']]
# build costs
cost={}
targets={'ConstructorMk1','SmelterMk1','FoundryMk1','AssemblerMk1','OilRefinery','ManufacturerMk1','Blender','HadronCollider','QuantumEncoder','Converter','Packager',
 'MinerMk1','MinerMk2','MinerMk3','OilPump','WaterPump','GeneratorCoal','GeneratorNuclear','GeneratorFuel','GeneratorBiomass_Automated'}
for k,r in R.items():
    if r['forBuilding'] and len(r['products'])==1 and sid(r['products'][0]['item']) in targets:
        t=sid(r['products'][0]['item'])
        cost[t]=[[sid(x['item']),x['amount']] for x in r['ingredients']]
        for x in r['ingredients']:
            ik=x['item']
            if sid(ik) not in items: items[sid(ik)]=[I[ik]['name'],es_item(I[ik]['name']),0,I[ik]['sinkPoints'],0]
gens=[]
for k,g in d['generators'].items():
    b=B[k]; gens.append({'id':sid(k),'n':b['name'],'ne':MACHINES.get(b['name'],b['name']),'mw':g['powerProduction'],'w':g['waterToPowerRatio'],'f':[sid(x) for x in g['fuel']]})
out={'v':'1.0','items':items,'recipes':recipes,'machines':machines,'cost':cost,'gens':gens,'res':[sid(k) for k in d['resources']]}
s=json.dumps(out,ensure_ascii=False,separators=(',',':'))
open(os.path.join(os.path.dirname(__file__),'..','src','data.json'),'w').write(s)
print(len(s),len(items),len(recipes),sorted(cost),missing)
