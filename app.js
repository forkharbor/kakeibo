// ============================================================
// データの読み込み・保存（ブラウザのlocalStorageを使用）
// ============================================================

function loadData() {
  const banks = JSON.parse(localStorage.getItem('kakeibo_banks') || '[]');
  const transactions = JSON.parse(localStorage.getItem('kakeibo_transactions') || '[]');
  return { banks, transactions };
}

function saveData(banks, transactions) {
  localStorage.setItem('kakeibo_banks', JSON.stringify(banks));
  localStorage.setItem('kakeibo_transactions', JSON.stringify(transactions));
}

// ============================================================
// 銀行口座の追加・削除
// ============================================================

function addBank() {
  const nameInput = document.getElementById('input-bank-name');
  const balanceInput = document.getElementById('input-bank-balance');

  const name = nameInput.value.trim();
  const initialBalance = parseFloat(balanceInput.value) || 0;

  if (!name) {
    alert('銀行名を入力してください');
    return;
  }

  const { banks, transactions } = loadData();

  if (banks.find(b => b.name === name)) {
    alert('同じ名前の口座がすでに存在します');
    return;
  }

  // 「手持ち現金」は予約IDを使用して既存の取引と紐づける
  const id = name === '手持ち現金' ? 'cash' : Date.now().toString();

  const newBank = {
    id: id,
    name: name,
    initialBalance: initialBalance
  };

  banks.push(newBank);
  saveData(banks, transactions);

  nameInput.value = '';
  balanceInput.value = '';

  renderAll();
}

function deleteBank(bankId) {
  if (!confirm('この口座を削除しますか？関連する取引も削除されます。')) return;

  let { banks, transactions } = loadData();
  banks = banks.filter(b => b.id !== bankId);
  transactions = transactions.filter(t => t.bankId !== bankId);

  saveData(banks, transactions);
  renderAll();
}

// ============================================================
// 取引の追加・削除
// ============================================================

function addTransaction() {
  const date = document.getElementById('input-date').value;
  const type = document.getElementById('input-type').value;
  const bankId = document.getElementById('input-bank-select').value;
  const amount = parseFloat(document.getElementById('input-amount').value);
  const memo = document.getElementById('input-memo').value.trim();

  if (!date) { alert('日付を選択してください'); return; }
  if (!bankId) { alert('銀行口座を選択してください'); return; }
  if (!amount || amount <= 0) { alert('正しい金額を入力してください'); return; }

  const { banks, transactions } = loadData();

  const newTransaction = {
    id: Date.now().toString(),
    date: date,
    type: type,
    bankId: bankId,
    amount: amount,
    memo: memo
  };

  transactions.push(newTransaction);
  saveData(banks, transactions);

  // フォームをリセット
  document.getElementById('input-amount').value = '';
  document.getElementById('input-memo').value = '';

  renderAll();
}

function bulkDeleteTransactions() {
  const filterBankId = document.getElementById('filter-bank').value;
  const filterType = document.getElementById('filter-type').value;

  let { banks, transactions } = loadData();

  let targets = [...transactions];
  if (filterBankId) targets = targets.filter(t => t.bankId === filterBankId);
  if (filterType) targets = targets.filter(t => t.type === filterType);

  if (targets.length === 0) {
    alert('削除対象の取引がありません');
    return;
  }

  const label = filterBankId || filterType ? '表示中の' : 'すべての';
  if (!confirm(`${label}取引 ${targets.length}件 を削除しますか？`)) return;

  // 削除前の残高を initialBalance に反映して残高を維持する
  banks = banks.map(bank => ({ ...bank, initialBalance: calcBalance(bank.id) }));

  const targetIds = new Set(targets.map(t => t.id));
  transactions = transactions.filter(t => !targetIds.has(t.id));

  saveData(banks, transactions);
  renderAll();
}

function deleteAllBanks() {
  const { banks } = loadData();
  if (banks.length === 0) {
    alert('削除する口座がありません');
    return;
  }
  if (!confirm(`全口座（${banks.length}件）と関連する取引をすべて削除しますか？`)) return;
  saveData([], []);
  renderAll();
}

function deleteTransaction(transactionId) {
  if (!confirm('この取引を削除しますか？')) return;

  let { banks, transactions } = loadData();
  transactions = transactions.filter(t => t.id !== transactionId);

  saveData(banks, transactions);
  renderAll();
}

// ============================================================
// 残高の計算
// ============================================================

function calcBalance(bankId) {
  const { banks, transactions } = loadData();
  const bank = banks.find(b => b.id === bankId);
  if (!bank) return 0;

  let balance = bank.initialBalance;
  transactions
    .filter(t => t.bankId === bankId)
    .forEach(t => {
      if (t.type === 'income') balance += t.amount;
      if (t.type === 'expense') balance -= t.amount;
    });

  return balance;
}

// ============================================================
// 画面の描画
// ============================================================

function renderBankList() {
  const { banks } = loadData();
  const list = document.getElementById('bank-list');
  list.innerHTML = '';

  banks.forEach(bank => {
    const li = document.createElement('li');
    const balance = calcBalance(bank.id);
    li.innerHTML = `
      <span class="bank-info">${escapeHtml(bank.name)}（残高: ${balance.toLocaleString()}円）</span>
      <button onclick="deleteBank('${bank.id}')">削除</button>
    `;
    list.appendChild(li);
  });
}

function renderBankSelects() {
  const { banks } = loadData();

  const selects = [
    document.getElementById('input-bank-select'),
    document.getElementById('filter-bank')
  ];

  selects.forEach(select => {
    const currentValue = select.value;
    // 最初のoption（「-- 口座を選択 --」など）を残す
    while (select.options.length > 1) {
      select.remove(1);
    }
    banks.forEach(bank => {
      const option = document.createElement('option');
      option.value = bank.id;
      option.textContent = bank.name;
      select.appendChild(option);
    });
    // 選択状態を復元
    select.value = currentValue;
  });
}

function renderSummary() {
  const { banks } = loadData();
  const container = document.getElementById('summary-list');
  container.innerHTML = '';

  if (banks.length === 0) {
    container.innerHTML = '<p style="color:#aaa;">口座が登録されていません</p>';
    return;
  }

  let total = 0;
  banks.forEach(bank => {
    const balance = calcBalance(bank.id);
    total += balance;
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `
      <div class="bank-name">${escapeHtml(bank.name)}</div>
      <div class="balance">${balance.toLocaleString()}円</div>
    `;
    container.appendChild(card);
  });

  const totalDiv = document.createElement('div');
  totalDiv.className = 'summary-total';
  totalDiv.innerHTML = `
    <span class="summary-total-label">全口座合計</span>
    <span class="summary-total-amount">${total.toLocaleString()}円</span>
  `;
  container.insertBefore(totalDiv, container.firstChild);
}

function renderHistory() {
  const { banks, transactions } = loadData();
  const filterBankId = document.getElementById('filter-bank').value;
  const filterType = document.getElementById('filter-type').value;

  let filtered = [...transactions];
  if (filterBankId) filtered = filtered.filter(t => t.bankId === filterBankId);
  if (filterType) filtered = filtered.filter(t => t.type === filterType);

  // 日付の新しい順に並び替え
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById('history-body');
  const noHistory = document.getElementById('no-history');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    document.getElementById('history-table').style.display = 'none';
    noHistory.style.display = 'block';
    return;
  }

  document.getElementById('history-table').style.display = 'table';
  noHistory.style.display = 'none';

  filtered.forEach(t => {
    const bank = banks.find(b => b.id === t.bankId);
    const bankName = bank ? bank.name : '（削除済み）';
    const typeLabel = t.type === 'income' ? '収入' : '支出';
    const typeClass = t.type === 'income' ? 'type-income' : 'type-expense';
    const sign = t.type === 'income' ? '+' : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td class="${typeClass}">${typeLabel}</td>
      <td>${escapeHtml(bankName)}</td>
      <td class="${typeClass}">${sign}${t.amount.toLocaleString()}円</td>
      <td>${escapeHtml(t.memo)}</td>
      <td class="action-buttons">
        <button class="btn-edit" onclick="editTransaction('${t.id}')">編集</button>
        <button class="btn-delete" onclick="deleteTransaction('${t.id}')">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAll() {
  renderBankList();
  renderBankSelects();
  renderSummary();
  renderHistory();
}

// ============================================================
// 取引の編集
// ============================================================

function editTransaction(transactionId) {
  const { banks, transactions } = loadData();
  const t = transactions.find(tx => tx.id === transactionId);
  if (!t) return;

  document.getElementById('edit-id').value = t.id;
  document.getElementById('edit-date').value = t.date;
  document.getElementById('edit-type').value = t.type;
  document.getElementById('edit-amount').value = t.amount;
  document.getElementById('edit-memo').value = t.memo;

  const select = document.getElementById('edit-bank-select');
  while (select.options.length > 1) select.remove(1);
  banks.forEach(bank => {
    const option = document.createElement('option');
    option.value = bank.id;
    option.textContent = bank.name;
    select.appendChild(option);
  });
  select.value = t.bankId;

  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

function saveEditTransaction() {
  const id = document.getElementById('edit-id').value;
  const date = document.getElementById('edit-date').value;
  const type = document.getElementById('edit-type').value;
  const bankId = document.getElementById('edit-bank-select').value;
  const amount = parseFloat(document.getElementById('edit-amount').value);
  const memo = document.getElementById('edit-memo').value.trim();

  if (!date) { alert('日付を選択してください'); return; }
  if (!bankId) { alert('銀行口座を選択してください'); return; }
  if (!amount || amount <= 0) { alert('正しい金額を入力してください'); return; }

  let { banks, transactions } = loadData();
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return;

  transactions[idx] = { ...transactions[idx], date, type, bankId, amount, memo };
  saveData(banks, transactions);
  closeEditModal();
  renderAll();
}

// ============================================================
// XSS対策：HTMLエスケープ
// ============================================================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 初期化
// ============================================================

// 今日の日付をデフォルトにセット
document.getElementById('input-date').value = new Date().toISOString().split('T')[0];

// 初回描画
renderAll();
