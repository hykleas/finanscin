const state = {
  mode: 'login',
  user: null,
  transactions: [],
  categories: { income: [], expense: [] },
  analytics: null,
  charts: { trend: null, category: null }
};

const moneyFormat = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2
});

const themeOptions = [
  { value: 'theme-aurora', label: 'Aurora (Varsayılan)' },
  { value: 'theme-midnight', label: 'Midnight' },
  { value: 'theme-sunset', label: 'Sunset' },
  { value: 'theme-forest', label: 'Forest' }
];

const el = {
  authView: document.getElementById('authView'),
  dashboardView: document.getElementById('dashboardView'),
  authForm: document.getElementById('authForm'),
  authTabs: document.getElementById('authTabs'),
  authMessage: document.getElementById('authMessage'),
  nameField: document.getElementById('nameField'),
  userName: document.getElementById('userName'),
  logoutBtn: document.getElementById('logoutBtn'),
  themeSelect: document.getElementById('themeSelect'),
  transactionForm: document.getElementById('transactionForm'),
  transactionMessage: document.getElementById('transactionMessage'),
  transactionTable: document.getElementById('transactionTable'),
  rangeSelect: document.getElementById('rangeSelect'),
  goalForm: document.getElementById('goalForm'),
  goalMessage: document.getElementById('goalMessage')
};

function setMessage(target, message, isError = false) {
  target.textContent = message;
  target.className = isError ? 'small text-danger m-0' : 'small text-success m-0';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    // ignore parse errors for empty responses
  }

  if (!response.ok) {
    throw new Error(data.error || 'Bir hata oluştu.');
  }

  return data;
}

function applyTheme(theme) {
  document.body.className = theme;
}

function renderThemeSelect() {
  el.themeSelect.innerHTML = themeOptions
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');
}

function populateCategoryOptions() {
  const type = el.transactionForm.type.value;
  const categories = state.categories[type] || [];
  el.transactionForm.category.innerHTML = categories
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join('');
}

function renderTransactions() {
  if (!state.transactions.length) {
    el.transactionTable.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Henüz işlem yok.</td></tr>';
    return;
  }

  el.transactionTable.innerHTML = state.transactions
    .slice(0, 25)
    .map(
      (item) => `
        <tr>
          <td>${new Date(item.transactionDate).toLocaleDateString('tr-TR')}</td>
          <td><span class="badge ${item.type === 'income' ? 'badge-income' : 'badge-expense'}">${item.type === 'income' ? 'Gelir' : 'Gider'}</span></td>
          <td>${item.category}</td>
          <td class="fw-semibold">${moneyFormat.format(item.amount)}</td>
          <td>${item.note || '-'}</td>
          <td><button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${item.id})">Sil</button></td>
        </tr>
      `
    )
    .join('');
}

function updateMetrics() {
  if (!state.analytics) return;
  document.getElementById('incomeValue').textContent = moneyFormat.format(state.analytics.income);
  document.getElementById('expenseValue').textContent = moneyFormat.format(state.analytics.expense);
  document.getElementById('balanceValue').textContent = moneyFormat.format(state.analytics.balance);
  document.getElementById('savingRateValue').textContent = `%${state.analytics.savingsRate.toFixed(1)}`;
}

function updateGoals() {
  const incomeGoal = Number(state.user.monthlyIncomeGoal || 0);
  const savingGoal = Number(state.user.monthlySavingGoal || 0);
  const incomeRate = incomeGoal > 0 ? Math.min((state.analytics.income / incomeGoal) * 100, 100) : 0;
  const savingRate = savingGoal > 0 ? Math.min((state.analytics.balance / savingGoal) * 100, 100) : 0;

  const incomeBar = document.getElementById('incomeGoalBar');
  const savingBar = document.getElementById('savingGoalBar');
  incomeBar.style.width = `${incomeRate}%`;
  savingBar.style.width = `${Math.max(savingRate, 0)}%`;

  document.getElementById('incomeGoalText').textContent = incomeGoal
    ? `Gelir hedefi: ${moneyFormat.format(state.analytics.income)} / ${moneyFormat.format(incomeGoal)}`
    : 'Gelir hedefi belirlemediniz.';
  document.getElementById('savingGoalText').textContent = savingGoal
    ? `Tasarruf hedefi: ${moneyFormat.format(state.analytics.balance)} / ${moneyFormat.format(savingGoal)}`
    : 'Tasarruf hedefi belirlemediniz.';
}

function renderCharts() {
  if (!state.analytics) return;

  const trendCtx = document.getElementById('trendChart');
  const categoryCtx = document.getElementById('categoryChart');

  if (state.charts.trend) state.charts.trend.destroy();
  if (state.charts.category) state.charts.category.destroy();

  const labels = state.analytics.trend.map((item) => item.month);

  state.charts.trend = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Gelir',
          data: state.analytics.trend.map((item) => item.income),
          borderColor: '#16a34a',
          tension: 0.3
        },
        {
          label: 'Gider',
          data: state.analytics.trend.map((item) => item.expense),
          borderColor: '#ef4444',
          tension: 0.3
        }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  state.charts.category = new Chart(categoryCtx, {
    type: 'doughnut',
    data: {
      labels: state.analytics.expensesByCategory.map((item) => item.category),
      datasets: [
        {
          data: state.analytics.expensesByCategory.map((item) => item.total),
          backgroundColor: ['#6366f1', '#f97316', '#22c55e', '#e11d48', '#0ea5e9', '#facc15']
        }
      ]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

async function loadDashboard(range = el.rangeSelect.value) {
  const txData = await api('/api/transactions');
  state.transactions = txData.items;
  state.categories = txData.categories;
  populateCategoryOptions();
  renderTransactions();

  state.analytics = await api(`/api/analytics/summary?range=${range}`);
  updateMetrics();
  updateGoals();
  renderCharts();
}

async function initializeApp() {
  renderThemeSelect();
  const me = await api('/api/auth/me');
  if (!me.loggedIn) {
    el.authView.classList.remove('d-none');
    el.dashboardView.classList.add('d-none');
    return;
  }

  state.user = me.user;
  el.userName.textContent = state.user.fullName;
  applyTheme(state.user.theme || 'theme-aurora');
  el.themeSelect.value = state.user.theme || 'theme-aurora';

  el.goalForm.monthlyIncomeGoal.value = state.user.monthlyIncomeGoal || '';
  el.goalForm.monthlySavingGoal.value = state.user.monthlySavingGoal || '';

  el.authView.classList.add('d-none');
  el.dashboardView.classList.remove('d-none');
  await loadDashboard();
}

el.authTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (!button) return;

  state.mode = button.dataset.mode;
  [...el.authTabs.querySelectorAll('button')].forEach((btn) => btn.classList.remove('active'));
  button.classList.add('active');
  el.nameField.classList.toggle('d-none', state.mode === 'login');
});

el.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(el.authForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    await api(`/api/auth/${state.mode}`, { method: 'POST', body: JSON.stringify(payload) });
    setMessage(el.authMessage, 'Giriş başarılı, panel hazırlanıyor...');
    await initializeApp();
  } catch (error) {
    setMessage(el.authMessage, error.message, true);
  }
});

el.transactionForm.type.addEventListener('change', populateCategoryOptions);

el.transactionForm.transactionDate.value = new Date().toISOString().split('T')[0];

el.transactionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(el.transactionForm).entries());

  try {
    await api('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
    setMessage(el.transactionMessage, 'İşlem eklendi.');
    el.transactionForm.amount.value = '';
    el.transactionForm.note.value = '';
    await loadDashboard();
  } catch (error) {
    setMessage(el.transactionMessage, error.message, true);
  }
});

window.deleteTransaction = async (id) => {
  if (!window.confirm('Bu işlemi silmek istediğine emin misin?')) return;
  try {
    await api(`/api/transactions/${id}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
};

el.rangeSelect.addEventListener('change', () => loadDashboard(el.rangeSelect.value));

el.logoutBtn.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.reload();
});

el.themeSelect.addEventListener('change', async () => {
  const theme = el.themeSelect.value;
  applyTheme(theme);
  await api('/api/user/preferences', { method: 'PUT', body: JSON.stringify({ theme }) });
});

el.goalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    monthlyIncomeGoal: Number(el.goalForm.monthlyIncomeGoal.value || 0),
    monthlySavingGoal: Number(el.goalForm.monthlySavingGoal.value || 0)
  };

  try {
    await api('/api/user/preferences', { method: 'PUT', body: JSON.stringify(payload) });
    state.user.monthlyIncomeGoal = payload.monthlyIncomeGoal;
    state.user.monthlySavingGoal = payload.monthlySavingGoal;
    setMessage(el.goalMessage, 'Hedefler güncellendi.');
    updateGoals();
  } catch (error) {
    setMessage(el.goalMessage, error.message, true);
  }
});

initializeApp();
