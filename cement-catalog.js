// 配合試験：主要セメント系固化材カタログ
// 画面上は「製品名｜用途」を表示し、保存値は製品名のみとする。
(function(){
  'use strict';

  const GROUPS = [
    {
      label: 'ジオセット（太平洋セメント）',
      items: [
        ['ジオセット200', '汎用（特殊土用）'],
        ['ジオセット225', '高有機質土用'],
        ['ジオセット263', 'PTFE処理防塵型・汎用（特殊土用）'],
        ['ジオセット265', 'PTFE処理防塵型・高有機質土用'],
        ['ジオセット275', '高含水比用・セメント石灰複合系'],
        ['ジオセット280', 'アルコール系・発塵抑制型（地域限定）'],
        ['ジオセット211', '汎用（特殊土用）・北海道地区限定'],
        ['ジオセット227', '北海道地区限定'],
        ['ジオセット300', '泥炭用・北海道地区限定'],
      ],
    },
    {
      label: 'ユースタビラー（UBE三菱セメント）',
      items: [
        ['ユースタビラー10', '一般軟弱土用'],
        ['ユースタビラースーパー1', '発塵抑制型（ユースタビラー10系）'],
        ['ユースタビラー60', '一般・高有機質土用'],
        ['ユースタビラー65', '一般・高有機質土用／高強度型'],
        ['ユースタビラースーパー6', '発塵抑制型（60シリーズ）'],
        ['ユースタビラー70', '火山灰質粘性土・高有機質土用'],
        ['ユースタビラー75', '火山灰質粘性土・高有機質土用／高強度型'],
        ['ユースタビラースーパー7', '発塵抑制型（70シリーズ）'],
      ],
    },
    {
      label: 'タフロック（住友大阪セメント）',
      items: [
        ['タフロック3E型', '汎用・一般軟弱土用'],
        ['タフロック4型', '高含水・高有機質土／有機ヘドロ用'],
        ['タフロック2000型', '高有機質土・火山灰質粘性土用'],
        ['タフロックエース', '発塵抑制型'],
        ['タフロックスーパー', '高含水土用・速硬／脱水・セメント石灰複合系'],
      ],
    },
    {
      label: '日鉄アースタイト',
      items: [
        ['日鉄アースタイト101', '一般軟弱土用・東北限定'],
        ['日鉄アースタイト105', '特殊土用（汎用）・東日本'],
        ['日鉄アースタイト105プラス', 'PTFE処理防塵型・北海道限定'],
        ['日鉄アースタイト201', '泥炭用・東日本'],
        ['日鉄アースタイトR100', '特殊土用（汎用）・近畿／中国'],
        ['日鉄アースタイトR110', '四国向け'],
        ['日鉄アースタイトR300', '一般・特殊土・高有機質土用・九州'],
      ],
    },
    {
      label: 'ソリッドエース（麻生セメント）',
      items: [
        ['ソリッドエース#200', '高有機質土用'],
        ['ソリッドエース#210', '高有機質土用・火山灰質粘性土向け'],
        ['ソリッドエース#220', '高有機質土用・腐植土向け'],
        ['ソリッドエース#400', '特殊土用（汎用型）'],
        ['ソリッドエース#500', '高含水比用・セメント石灰複合系'],
        ['スーパーソリッドエース#200', 'PTFE処理・発塵抑制型／高有機質土用'],
        ['スーパーソリッドエース#400', 'PTFE処理・発塵抑制型／特殊土用'],
      ],
    },
    {
      label: 'ハードキープ（トクヤマ）',
      items: [
        ['ハードキープP-430', '一般軟弱土用'],
        ['ハードキープP-450', '一般軟弱土用'],
        ['ハードキープP-530', '特殊土用'],
        ['ハードキープP-540', '特殊土用'],
        ['ハードキープP-550', '特殊土用'],
        ['ハードキープP-730', '高有機質土・火山灰質粘性土用'],
        ['ハードキープP-310', '高有機質土用'],
        ['ハードキープLD', '発塵抑制型'],
      ],
    },
  ];

  const BUILT_IN_NAMES = new Set(GROUPS.flatMap(group => group.items.map(item => item[0])));
  let applying = false;
  let catalogObserver = null;

  function optionExists(select, value){
    return Array.from(select.options).some(option => option.value === value);
  }

  function currentCustomNames(select){
    const values = Array.from(select.options)
      .map(option => option.value)
      .filter(value => value && value !== '__manual__' && !BUILT_IN_NAMES.has(value));
    return [...new Set(values)];
  }

  function appendGroup(select, label, items){
    const group = document.createElement('optgroup');
    group.label = label;
    items.forEach(([name, type]) => {
      const option = new Option(`${name}｜${type}`, name);
      group.appendChild(option);
    });
    select.appendChild(group);
  }

  function applyCatalog(select){
    if (!select || applying) return;
    applying = true;
    catalogObserver?.disconnect();

    const form = select.form;
    const manual = form?.elements?.cementManual;
    const previous = select.value;
    const manualText = manual?.value?.trim() || '';
    const customNames = currentCustomNames(select);

    select.innerHTML = '';
    select.add(new Option('選択してください', ''));
    GROUPS.forEach(group => appendGroup(select, group.label, group.items));

    if (customNames.length) {
      appendGroup(
        select,
        '登録済み／その他',
        customNames.sort((a,b) => a.localeCompare(b, 'ja-JP')).map(name => [name, '登録済み'])
      );
    }
    select.add(new Option('その他／新しいセメントを入力', '__manual__'));

    let nextValue = previous;
    if (previous === '__manual__' && !manualText) nextValue = '';
    if (nextValue && nextValue !== '__manual__' && !optionExists(select, nextValue)) {
      const group = document.createElement('optgroup');
      group.label = '保存済み';
      group.appendChild(new Option(`${nextValue}｜保存済み`, nextValue));
      select.insertBefore(group, select.lastElementChild);
    }
    select.value = optionExists(select, nextValue) ? nextValue : '';

    applying = false;
    catalogObserver?.observe(select, { childList:true });

    if (select.value !== previous) {
      select.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }

  function install(){
    const select = document.querySelector('#mixDesignForm select[name="cementChoice"]');
    if (!select || select.dataset.cementCatalogInstalled === '1') return;
    select.dataset.cementCatalogInstalled = '1';

    catalogObserver = new MutationObserver(() => {
      if (!applying) queueMicrotask(() => applyCatalog(select));
    });
    catalogObserver.observe(select, { childList:true });
    applyCatalog(select);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
