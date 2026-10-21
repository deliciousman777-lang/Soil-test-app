from pathlib import Path

path = Path('compaction.js')
s = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'Patch target not found: {label}')
    s = s.replace(old, new, 1)


replace_once(
    "  const PERMEABILITY_VOLUME=1000; // cm3\n",
    """  const PERMEABILITY_VOLUME=1000; // cm3
  const METHOD_PRESETS={
    'B-b':{rammerMass:'2.5',dropHeight:'30',blows:'55',layers:'3',moldDiameter:'15',moldHeight:'12.50',moldVolume:'2209',maxParticle:'37.5',preparation:'乾燥法・非繰返し法'},
    'A-b':{rammerMass:'2.5',dropHeight:'30',blows:'25',layers:'3',moldDiameter:'10',moldHeight:'12.73',moldVolume:'1000',maxParticle:'19',preparation:'乾燥法・非繰返し法'},
    'B-c':{rammerMass:'2.5',dropHeight:'30',blows:'55',layers:'3',moldDiameter:'15',moldHeight:'12.50',moldVolume:'2209',maxParticle:'37.5',preparation:'湿潤法・非繰返し法'},
    'A-c':{rammerMass:'2.5',dropHeight:'30',blows:'25',layers:'3',moldDiameter:'10',moldHeight:'12.73',moldVolume:'1000',maxParticle:'19',preparation:'湿潤法・非繰返し法'},
    'E':{rammerMass:'4.5',dropHeight:'45',blows:'92',layers:'3',moldDiameter:'15',moldHeight:'12.50',moldVolume:'2209',maxParticle:'37.5',preparation:'乾燥法・非繰返し法'}
  };
""",
    'method preset table'
)

replace_once(
    "  function dialogEl(){return document.getElementById('compactionDialog');}\n",
    """  function dialogEl(){return document.getElementById('compactionDialog');}

  function applyMethodPreset(method){
    const f=formEl(),preset=METHOD_PRESETS[method];
    if(!f||!preset)return;
    Object.entries(preset).forEach(([name,value])=>{if(f.elements[name])f.elements[name].value=value;});
  }
""",
    'applyMethodPreset function'
)

replace_once(
    '<label>試験方法<input name=\\"method\\" value=\\"B-b\\" autocomplete=\\"off\\"></label>',
    '<label>試験方法<select name=\\"method\\"><option value=\\"B-b\\">B-b法</option><option value=\\"A-b\\">A-b法</option><option value=\\"B-c\\">B-c法</option><option value=\\"A-c\\">A-c法</option><option value=\\"E\\">E法</option></select></label>',
    'method selector'
)

replace_once(
    'B-b の標準値を初期入力。必要なら変更できます。',
    '試験方法を選ぶと標準条件を自動設定します。必要なら変更できます。',
    'condition guidance'
)

replace_once(
    'name=\\"maxParticle\\" inputmode=\\"decimal\\" value=\\"53\\"',
    'name=\\"maxParticle\\" inputmode=\\"decimal\\" value=\\"37.5\\"',
    'B-b max particle default'
)

replace_once(
    "    const f=formEl();\n    f.addEventListener('input',updatePreview);f.addEventListener('change',updatePreview);f.addEventListener('submit',saveTest);",
    "    const f=formEl();\n    f.elements.method.addEventListener('change',()=>applyMethodPreset(f.elements.method.value));\n    f.addEventListener('input',updatePreview);f.addEventListener('change',updatePreview);f.addEventListener('submit',saveTest);",
    'method change listener'
)

replace_once(
    "    Object.assign(f.elements.method,{value:'B-b'});f.elements.rammerMass.value='2.5';f.elements.dropHeight.value='30';f.elements.blows.value='55';f.elements.layers.value='3';f.elements.moldDiameter.value='15';f.elements.moldHeight.value='12.50';f.elements.moldVolume.value='2209';f.elements.maxParticle.value='53';f.elements.preparation.value='乾燥法・非繰返し法';f.elements.triaxialRatio.value='95';f.elements.permeabilityRatio.value='95';f.elements.triaxialMoistureMode.value='optimum';f.elements.permeabilityMoistureMode.value='optimum';",
    "    f.elements.method.value='B-b';applyMethodPreset('B-b');f.elements.triaxialRatio.value='95';f.elements.permeabilityRatio.value='95';f.elements.triaxialMoistureMode.value='optimum';f.elements.permeabilityMoistureMode.value='optimum';",
    'reset defaults'
)

path.write_text(s, encoding='utf-8')

sw = Path('sw.js')
sws = sw.read_text(encoding='utf-8')
if "soil-test-cache-v57" not in sws:
    raise SystemExit('Expected cache v57 not found')
sw.write_text(sws.replace('soil-test-cache-v57', 'soil-test-cache-v58', 1), encoding='utf-8')
