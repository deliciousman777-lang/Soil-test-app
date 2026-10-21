from pathlib import Path

path = Path('fine-sieve.js')
s = path.read_text(encoding='utf-8')
old = '''  resetGrainDialog = function () {
    previousReset();
    if (grainForm.elements.fineDryMass) grainForm.elements.fineDryMass.value = '';
    updateGrainPreviewFine();
  };'''
new = '''  resetGrainDialog = function () {
    previousReset();
    if (grainForm.elements.fineDryMass) grainForm.elements.fineDryMass.value = '';
    updateGrainPreviewFine();
    if (typeof syncTwoMmPassingRatio === 'function') syncTwoMmPassingRatio();
    if (typeof updateSedimentationPreview === 'function') updateSedimentationPreview();
  };'''
if old not in s:
    raise SystemExit('fine-sieve reset target not found')
path.write_text(s.replace(old, new, 1), encoding='utf-8')

sw = Path('sw.js')
sws = sw.read_text(encoding='utf-8')
if "soil-test-cache-v59" not in sws:
    raise SystemExit('Expected cache v59 not found')
sw.write_text(sws.replace('soil-test-cache-v59', 'soil-test-cache-v60', 1), encoding='utf-8')
