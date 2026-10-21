from pathlib import Path

path = Path('sedimentation.js')
s = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'Patch target not found: {label}')
    s = s.replace(old, new, 1)


replace_once(
'''      <label>沈降分析用試料の乾燥質量 ms1 (g)
        <div class="voice-input"><input name="sedDryMass" inputmode="decimal" placeholder="例：73.4" /><button type="button" class="mic" data-voice="sedDryMass" data-form="grainForm">🎤</button></div>
      </label>''',
'''      <label>2 mm通過試料の炉乾燥質量 ms1 (g)<input name="sedDryMass" inputmode="decimal" readonly placeholder="上の2 mm通過試料質量から自動" /></label>''',
'duplicate ms1 input'
)

replace_once(
'''      <label>2 mm通過質量比 (%)<input id="twoMmPassRatio" name="twoMmPassRatio" inputmode="decimal" placeholder="ふるい分析から自動" /></label>''',
'''      <label>2 mm通過質量比 (%)<input id="twoMmPassRatio" name="twoMmPassRatio" inputmode="decimal" readonly placeholder="ふるい分析から自動" /></label>''',
'two mm pass ratio readonly'
)

replace_once(
'''    <p class="hint">水温・F・開始時刻は上で1回だけ入力。各測定では浮ひょうの読み r だけ入力すれば、測定時刻・r+Cm・有効深さL・K・粒径d・P・P(d)を自動計算します。</p>''',
'''    <p class="hint">上の「2 mmふるい通過試料の炉乾燥質量 ms1」を1回入力すれば沈降分析にも自動反映します。あとは浮ひょうの読み r を入力すると、測定時刻・r+Cm・有効深さL・K・粒径d・P・P(d)を自動計算します。</p>''',
'workflow hint'
)

replace_once(
'''function sedimentationSettingsExt() {
  const cylinderNo = grainForm.elements.cylinderNo?.value.trim() ?? '';
  const hydrometerNo = grainForm.elements.hydrometerNo?.value.trim() || '1';
  const ms1 = Number(grainForm.elements.sedDryMass?.value);''',
'''function sedimentationSettingsExt() {
  const cylinderNo = grainForm.elements.cylinderNo?.value.trim() ?? '';
  const hydrometerNo = grainForm.elements.hydrometerNo?.value.trim() || '1';
  const fineMassRaw = grainForm.elements.fineDryMass?.value ?? grainForm.elements.sedDryMass?.value ?? '';
  const ms1 = Number(fineMassRaw);''',
'use fine dry mass as ms1'
)

replace_once(
'''    check.textContent = '沈降分析用乾燥質量・土粒子密度・水温・F・2 mm通過率を確認してください。';''',
'''    check.textContent = '2 mm通過試料質量・土粒子密度・水温・F・2 mm通過率を確認してください。';''',
'validation text'
)

replace_once(
'''function syncTwoMmPassingRatio() {
  const field = grainForm.elements.twoMmPassRatio;
  if (!field || document.activeElement === field) return;
  const result = calculateGrain();
  if (!result.valid) return;
  const row2 = result.sieves?.find(row => row.size === 2);
  if (row2?.passing != null) field.value = row2.passing.toFixed(2);
}''',
'''function syncSedDryMassFromFine() {
  const source = grainForm.elements.fineDryMass;
  const target = grainForm.elements.sedDryMass;
  if (!target) return;
  const raw = source?.value?.trim() ?? '';
  target.value = raw;
}

function syncTwoMmPassingRatio() {
  syncSedDryMassFromFine();
  const field = grainForm.elements.twoMmPassRatio;
  if (!field) return;
  const result = calculateGrain();
  if (!result.valid) {
    field.value = '';
    return;
  }
  const row2 = result.sieves?.find(row => row.size === 2);
  field.value = row2?.passing != null ? row2.passing.toFixed(2) : '';
}''',
sync two mm ratio and ms1'
)

replace_once(
'''  if (grainForm.elements.sedDryMass) grainForm.elements.sedDryMass.value = s.ms1 ?? '';''',
'''  if (grainForm.elements.fineDryMass && !String(grainForm.elements.fineDryMass.value || '').trim() && s.ms1 != null) grainForm.elements.fineDryMass.value = s.ms1;
  syncSedDryMassFromFine();''',
'edit backward compatibility'
)

replace_once(
'''  if (useSedimentationEl) useSedimentationEl.checked = false;
  sedimentationSectionEl?.classList.add('hidden');
  updateSedimentationPreview();''',
'''  if (useSedimentationEl) useSedimentationEl.checked = false;
  sedimentationSectionEl?.classList.add('hidden');
  syncSedDryMassFromFine();
  syncTwoMmPassingRatio();
  updateSedimentationPreview();''',
'reset sync'
)

path.write_text(s, encoding='utf-8')

sw = Path('sw.js')
sws = sw.read_text(encoding='utf-8')
if "soil-test-cache-v58" not in sws:
    raise SystemExit('Expected cache v58 not found')
sw.write_text(sws.replace('soil-test-cache-v58', 'soil-test-cache-v59', 1), encoding='utf-8')
