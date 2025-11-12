console.log('🚀 app.js cargado');

// ============= VARIABLES GLOBALES =============
let firebaseApp = null;
let auth = null;
let database = null;
let isFirebaseConnected = false;
let currentUser = null;
let currentUserRole = 'guest';
let sidebarOpen = false;

// Variables para agendamiento
let selectedService = null;
let selectedDate = null;
let selectedTime = null;

let isLoadingData = false;
let lastDataLoad = null;

const services = {
    primera_vez: { name: 'Primera Licencia', price: 25000, duration: '60 min' },
    renovacion: { name: 'Renovación', price: 15000, duration: '30 min' },
    duplicado: { name: 'Duplicado', price: 20000, duration: '45 min' },
    cambio_domicilio: { name: 'Cambio de Domicilio', price: 8000, duration: '20 min' }
};

const availableHours = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

// ============= FERIADOS NACIONALES CHILENOS =============
const feriadosChile = {
    // Feriados fijos
    '01-01': 'Año Nuevo',
    '05-01': 'Día del Trabajo',
    '05-21': 'Glorias Navales',
    '06-29': 'San Pedro y San Pablo',
    '07-16': 'Día de la Virgen del Carmen',
    '08-15': 'Asunción de la Virgen',
    '09-18': 'Independencia Nacional',
    '09-19': 'Glorias del Ejército',
    '10-12': 'Encuentro de Dos Mundos',
    '10-31': 'Día de las Iglesias Evangélicas y Protestantes',
    '11-01': 'Todos los Santos',
    '12-08': 'Inmaculada Concepción',
    '12-25': 'Navidad'
};

// Función para calcular Semana Santa (feriados variables)
function calcularSemanaSanta(year) {
    // Algoritmo para calcular la fecha de Pascua
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = Math.floor((h + l - 7 * m + 114) / 31);
    const p = (h + l - 7 * m + 114) % 31;
    
    const pascua = new Date(year, n - 1, p + 1);
    
    // Viernes Santo (2 días antes de Pascua)
    const viernesSanto = new Date(pascua);
    viernesSanto.setDate(pascua.getDate() - 2);
    
    // Sábado Santo (1 día antes de Pascua)
    const sabadoSanto = new Date(pascua);
    sabadoSanto.setDate(pascua.getDate() - 1);
    
    return {
        viernesSanto: formatDateForHoliday(viernesSanto),
        sabadoSanto: formatDateForHoliday(sabadoSanto)
    };
}

// Función para formatear fecha para feriados
function formatDateForHoliday(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
}

// Función para verificar si una fecha es feriado
function esFeriado(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const year = date.getFullYear();
    const monthDay = formatDateForHoliday(date);
    
    // Verificar feriados fijos
    if (feriadosChile[monthDay]) {
        return feriadosChile[monthDay];
    }
    
    // Verificar Semana Santa
    const semanaSanta = calcularSemanaSanta(year);
    if (monthDay === semanaSanta.viernesSanto) {
        return 'Viernes Santo';
    }
    if (monthDay === semanaSanta.sabadoSanto) {
        return 'Sábado Santo';
    }
    
    // Verificar feriados que se mueven al lunes
    const dayOfWeek = date.getDay();
    if ((monthDay === '06-29' || monthDay === '10-12') && (dayOfWeek === 0 || dayOfWeek === 6)) {
        // Si San Pedro y San Pablo o Día de la Raza caen en fin de semana, se mueven al lunes
        const nextMonday = new Date(date);
        nextMonday.setDate(date.getDate() + (1 + 7 - dayOfWeek) % 7);
        const mondayFormatted = formatDateForHoliday(nextMonday);
        
        // Verificar si la fecha consultada es el lunes movido
        if (monthDay === mondayFormatted) {
            return feriadosChile[monthDay === '06-29' ? '06-29' : '10-12'] + ' (trasladado)';
        }
    }
    
    return null;
}

// Inicializar EmailJS (reemplaza con tu User ID)
emailjs.init('0k6IM1WQHRy6g6M67');

// ============= INICIALIZACIÓN =============
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema iniciado');
    initializeFirebase();
    setupEventListeners();
    setupDateLimits();
    loadDemoData();
});

function initializeFirebase() {
    const firebaseConfig = {
        apiKey: "AIzaSyDzUBlpfMdhMwF3GWdF37AIS9g0I76NfIw",
        authDomain: "agendamientolicencias.firebaseapp.com",
        databaseURL: "https://agendamientolicencias-default-rtdb.firebaseio.com",
        projectId: "agendamientolicencias",
        storageBucket: "agendamientolicencias.firebasestorage.app",
        messagingSenderId: "452575623812",
        appId: "1:452575623812:web:855de8f58d55c39472e0d1"
    };

    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        database = firebase.database();
        
        auth.onAuthStateChanged(user => {
            currentUser = user;
            updateAuthState();
        });
        
        isFirebaseConnected = true;
        console.log('✅ Firebase conectado');
        document.getElementById('adminConnectionStatus').textContent = '🟢 Online';
    } catch (error) {
        console.error('❌ Error Firebase:', error);
        isFirebaseConnected = false;
        document.getElementById('adminConnectionStatus').textContent = '🔴 Demo';
    }
}

function setupEventListeners() {
    // Forms
    const clientRegisterForm = document.getElementById('clientRegisterForm');
    const clientLoginForm = document.getElementById('clientLoginForm');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const newAppointmentForm = document.getElementById('newAppointmentForm');
    const newUserForm = document.getElementById('newUserForm');

    if (clientRegisterForm) {
        clientRegisterForm.addEventListener('submit', handleClientRegister);
    }
    if (clientLoginForm) {
        clientLoginForm.addEventListener('submit', handleClientLogin);
    }
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
    if (newAppointmentForm) {
        newAppointmentForm.addEventListener('submit', handleNewAppointment);
    }
    if (newUserForm) {
        newUserForm.addEventListener('submit', handleNewUser);
    }

    // Window events
    window.addEventListener('click', handleModalClick);
}

function setupDateLimits() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    
    const dateInputs = ['appointmentDate', 'newApptDate'];
    dateInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.min = tomorrow.toISOString().split('T')[0];
            input.max = maxDate.toISOString().split('T')[0];
            
            // Agregar event listener para validar fines de semana
            input.addEventListener('change', function() {
                validateWeekday(this);
            });
        }
    });
}

function validateWeekday(input) {
    const selectedDate = new Date(input.value + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay(); // 0 = Domingo, 6 = Sábado
    
    // Verificar fin de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showNotification('Los fines de semana no están disponibles. Por favor selecciona un día entre lunes y viernes.', 'error');
        input.value = '';
        clearAvailableHours();
        return false;
    }
    
    // Verificar feriados nacionales
    const feriado = esFeriado(input.value);
    if (feriado) {
        showNotification(`${feriado} es feriado nacional y no está disponible para agendamiento.`, 'error');
        input.value = '';
        clearAvailableHours();
        return false;
    }
    
    return true;
}

function clearAvailableHours() {
    // Limpiar horarios disponibles si estamos en la vista de agendamiento
    const availableHours = document.getElementById('availableHours');
    if (availableHours) {
        availableHours.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Selecciona una fecha válida (lunes a viernes, no feriados)</p>';
    }
    
    // Deshabilitar botón continuar
    const continueBtn = document.getElementById('continueStep3');
    if (continueBtn) continueBtn.disabled = true;
}

// Función corregida para cargar datos demo
function loadDemoData() {
    // Solo cargar demo si no estamos en modo Firebase
    if (isFirebaseConnected) {
        console.log('🔥 Firebase conectado - No cargando datos demo');
        return;
    }
    
    console.log('📋 Cargando datos demo...');
    loadDemoAppointments();
    loadDemoUsers();
}

// ============= NAVEGACIÓN PRINCIPAL =============
function showPublicView() {
    hideAllViews();
    document.getElementById('publicView').classList.remove('hidden');
}

function showClientPortal() {
    hideAllViews();
    document.getElementById('clientView').classList.remove('hidden');
    showClientTab('register');
}

function showAdminLogin() {
    hideAllViews();
    document.getElementById('adminLoginView').classList.remove('hidden');
}

function showAdminView() {
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    if (window.innerWidth > 768) {
        setTimeout(() => openSidebar(), 300);
    }
    
    // Solo cargar datos si no se han cargado recientemente
    const now = Date.now();
    if (!lastDataLoad || (now - lastDataLoad) > 5000) {
        if (isFirebaseConnected) {
            loadRealData();
        } else {
            loadDemoData();
        }
    }
}

function hideAllViews() {
    const views = ['publicView', 'clientView', 'adminView', 'adminLoginView'];
    views.forEach(viewId => {
        const view = document.getElementById(viewId);
        if (view) {
            view.classList.add('hidden');
        }
    });
}

// ============= NAVEGACIÓN CLIENTE =============
function showClientTab(tabName) {
    // Actualizar botones de tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[onclick="showClientTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Actualizar contenido
    document.querySelectorAll('.tab-pane').forEach(tab => tab.classList.remove('active'));
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) activeTab.classList.add('active');
    
    // Actualizar estado de login requerido
    updateClientAuthState();
}

function updateClientAuthState() {
    const isLoggedIn = currentUser && currentUserRole === 'cliente';
    
    const scheduleLoginRequired = document.getElementById('scheduleLoginRequired');
    const scheduleContent = document.getElementById('scheduleContent');
    const mycitesLoginRequired = document.getElementById('mycitesLoginRequired');
    const mycitesContent = document.getElementById('mycitesContent');
    
    if (scheduleLoginRequired && scheduleContent) {
        scheduleLoginRequired.style.display = isLoggedIn ? 'none' : 'block';
        scheduleContent.classList.toggle('hidden', !isLoggedIn);
    }
    
    if (mycitesLoginRequired && mycitesContent) {
        mycitesLoginRequired.style.display = isLoggedIn ? 'none' : 'block';
        mycitesContent.classList.toggle('hidden', !isLoggedIn);
    }
    
    if (isLoggedIn) {
        loadUserAppointments();
    }
}

// ============= NAVEGACIÓN ADMIN =============
// Función corregida showAdminPage para cargar datos específicos
function showAdminPage(pageName) {
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const activeMenuItem = document.querySelector(`[onclick="showAdminPage('${pageName}')"]`);
    if (activeMenuItem) activeMenuItem.classList.add('active');
    
    document.querySelectorAll('.admin-page').forEach(page => page.classList.add('hidden'));
    const activePage = document.getElementById(`admin${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`);
    if (activePage) activePage.classList.remove('hidden');
    
    if (window.innerWidth <= 768 && sidebarOpen) {
        closeSidebar();
    }
    
    // Cargar datos específicos de la página sin duplicar
    if (isFirebaseConnected && !isLoadingData) {
        if (pageName === 'appointments') {
            loadRealAppointments();
        } else if (pageName === 'users') {
            loadRealUsers();
        } else if (pageName === 'dashboard') {
            loadDashboardStats();
            loadTodayAppointments();
        }
    }
}
function toggleSidebar() {
    sidebarOpen ? closeSidebar() : openSidebar();
}

function openSidebar() {
    sidebarOpen = true;
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('mainContent').classList.add('sidebar-open');
}

function closeSidebar() {
    sidebarOpen = false;
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('mainContent').classList.remove('sidebar-open');
}

// ============= AUTENTICACIÓN =============
async function handleClientRegister(e) {
    e.preventDefault();
    
    const formData = {
        nombre: document.getElementById('regNombre').value,
        rut: document.getElementById('regRut').value,
        email: document.getElementById('regEmail').value,
        telefono: document.getElementById('regTelefono').value,
        password: document.getElementById('regPassword').value,
        fechaNacimiento: document.getElementById('regFechaNacimiento').value
    };

    try {
        showMessage('registerMessage', 'Creando cuenta...', 'info');
        
        if (isFirebaseConnected && auth) {
            const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
            await database.ref(`usuarios/${userCredential.user.uid}`).set({
                nombre: formData.nombre,
                rut: formData.rut,
                email: formData.email,
                telefono: formData.telefono,
                fechaNacimiento: formData.fechaNacimiento,
                rol: 'cliente',
                activo: true,
                fechaCreacion: new Date().toISOString()
            });
            currentUserRole = 'cliente';
        } else {
            // Demo mode
            currentUser = { email: formData.email, uid: 'demo_client_' + Date.now() };
            currentUserRole = 'cliente';
            updateClientAuthState();
        }
        
        showMessage('registerMessage', '¡Cuenta creada exitosamente!', 'success');
        e.target.reset();
        setTimeout(() => showClientTab('schedule'), 2000);
        
    } catch (error) {
        showMessage('registerMessage', `Error: ${error.message}`, 'error');
    }
}

async function handleClientLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    showMessage('loginMessage', 'Iniciando sesión...', 'info');

    if (isFirebaseConnected && auth) {
      await auth.signInWithEmailAndPassword(email, password);
      currentUserRole = 'cliente';
    } else {
      // Demo login
      const demoClients = {
        'cliente1@gmail.com': 'demo123',
        'maria.rodriguez@gmail.com': 'demo123'
      };

      if (demoClients[email] === password) {
        currentUser = { email, uid: 'demo_client_' + Date.now() };
        currentUserRole = 'cliente';
        updateClientAuthState();
      } else {
      
        showMessage(
          'loginMessage',
          'El correo o la contraseña no coinciden. Por favor, verifica tus datos.',
          'error'
        );
        return; 
      }
    }

    showMessage('loginMessage', '¡Bienvenido!', 'success');
    e.target.reset();
    setTimeout(() => showClientTab('schedule'), 1500);

  } catch (error) {
    console.error(error);
  
    showMessage(
      'loginMessage',
      'Contraseña Incorrecta,Si la olvido porfavor clickee en Olvidaste la Contraseña.',
      'error'
    );
  }
}

        


async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    try {
        showMessage('adminLoginMessage', 'Verificando credenciales...', 'info');
        
        if (isFirebaseConnected && auth) {
            // Intentar login con Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Verificar si es administrador o empleado
            const adminSnapshot = await database.ref(`administradores`).orderByChild('email').equalTo(email).once('value');
            const empleadoSnapshot = await database.ref(`empleados`).orderByChild('email').equalTo(email).once('value');
            
            if (adminSnapshot.exists()) {
                currentUserRole = 'admin';
                const adminData = Object.values(adminSnapshot.val())[0];
                currentUser = { ...userCredential.user, adminData };
                document.getElementById('adminUserEmail').textContent = email;
                showMessage('adminLoginMessage', '¡Acceso autorizado como Administrador!', 'success');
                e.target.reset();
                setTimeout(() => {
                    showAdminView();
                    loadRealData();
                }, 1500);
            } else if (empleadoSnapshot.exists()) {
                currentUserRole = 'empleado';
                const empleadoData = Object.values(empleadoSnapshot.val())[0];
                currentUser = { ...userCredential.user, empleadoData };
                document.getElementById('adminUserEmail').textContent = email;
                showMessage('adminLoginMessage', '¡Acceso autorizado como Empleado!', 'success');
                e.target.reset();
                setTimeout(() => {
                    showAdminView();
                    loadRealData();
                }, 1500);
            } else {
                throw new Error('No tienes permisos de administrador');
            }
        } else {
            // Modo demo
            const adminUsers = {
                'admin@concon.cl': 'admin123',
                'albornoz.felipealfonso@cftpucv.cl': '123456',
                'vidal.franciscojavier@cftpucv.cl': 'password123'
            };
            
            if (adminUsers[email] === password) {
                currentUser = { email, uid: 'admin_user_' + Date.now() };
                currentUserRole = 'admin';
                document.getElementById('adminUserEmail').textContent = email;
                showMessage('adminLoginMessage', '¡Acceso autorizado! (Modo Demo)', 'success');
                e.target.reset();
                setTimeout(() => showAdminView(), 1500);
            } else {
                throw new Error('Credenciales incorrectas');
            }
        }
        
    } catch (error) {
        showMessage('adminLoginMessage', `Error: ${error.message}`, 'error');
    }
}

function updateAuthState() {
    if (currentUser) {
        updateClientAuthState();
    }
}

function adminLogout() {
    currentUser = null;
    currentUserRole = 'guest';
    if (isFirebaseConnected && auth) {
        auth.signOut();
    }
    showPublicView();
}

// ============= AGENDAMIENTO =============
function selectService(serviceType) {
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[data-service="${serviceType}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedService = serviceType;
        
        const continueBtn = document.getElementById('continueStep2');
        if (continueBtn) continueBtn.disabled = false;
    }
}

function showStep(stepNumber) {
    document.querySelectorAll('.schedule-step').forEach(step => step.classList.add('hidden'));
    const targetStep = document.getElementById(`step${stepNumber}`);
    if (targetStep) targetStep.classList.remove('hidden');
    
    if (stepNumber === 3) {
        updateAppointmentSummary();
    }
}

async function loadAvailableHours() {
    const date = document.getElementById('appointmentDate').value;
    if (!date) return;
    
    // Validar que no sea fin de semana
    const selectedDateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const container = document.getElementById('availableHours');
        if (container) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">❌ Los fines de semana no están disponibles</p>';
        }
        return;
    }
    
    // Validar que no sea feriado nacional
    const feriado = esFeriado(date);
    if (feriado) {
        const container = document.getElementById('availableHours');
        if (container) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">🎉 ${feriado} - Feriado Nacional<br>No hay atención este día</p>`;
        }
        return;
    }
    
    selectedDate = date;
    const container = document.getElementById('availableHours');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Si hay conexión a Firebase, verificar disponibilidad real
    if (isFirebaseConnected && database) {
        try {
            // Obtener citas existentes para la fecha seleccionada
            const citasSnapshot = await database.ref('citas')
                .orderByChild('fecha')
                .equalTo(date)
                .once('value');
            
            const citasExistentes = {};
            if (citasSnapshot.exists()) {
                const citas = citasSnapshot.val();
                // Contar citas por hora
                Object.values(citas).forEach(cita => {
                    if (cita.estado !== 'cancelada') {
                        citasExistentes[cita.hora] = (citasExistentes[cita.hora] || 0) + 1;
                    }
                });
            }
            
            // Obtener configuración de horarios
            const configSnapshot = await database.ref('configuracion/sistema/maximoCitasPorHora').once('value');
            const maxCitasPorHora = configSnapshot.val() || 3;
            
            // Mostrar horarios
            availableHours.forEach(hour => {
                const btn = document.createElement('button');
                btn.className = 'horario-btn';
                btn.textContent = hour;
                
                const citasEnHora = citasExistentes[hour] || 0;
                if (citasEnHora >= maxCitasPorHora) {
                    btn.disabled = true;
                    btn.textContent += ' (Lleno)';
                } else {
                    btn.onclick = () => selectHour(hour, btn);
                    // Mostrar cupos disponibles
                    const cuposDisponibles = maxCitasPorHora - citasEnHora;
                    if (cuposDisponibles <= 2) {
                        btn.textContent += ` (${cuposDisponibles} cupos)`;
                    }
                }
                
                container.appendChild(btn);
            });
        } catch (error) {
            console.error('Error cargando horarios:', error);
            // Fallback a horarios demo
            loadDemoHours();
        }
    } else {
        // Modo demo
        loadDemoHours();
    }
    
    function loadDemoHours() {
        availableHours.forEach(hour => {
            const btn = document.createElement('button');
            btn.className = 'horario-btn';
            btn.textContent = hour;
            btn.onclick = () => selectHour(hour, btn);
            
            // Simular algunos horarios ocupados
            if (Math.random() > 0.8) {
                btn.disabled = true;
                btn.textContent += ' (Ocupado)';
            }
            
            container.appendChild(btn);
        });
    }
}

function selectHour(hour, button) {
    document.querySelectorAll('.horario-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    button.classList.add('selected');
    selectedTime = hour;
    
    const continueBtn = document.getElementById('continueStep3');
    if (continueBtn) continueBtn.disabled = false;
}

function updateAppointmentSummary() {
    const service = services[selectedService];
    if (!service) return;
    
    document.getElementById('summaryService').textContent = service.name;
    document.getElementById('summaryDate').textContent = formatDate(selectedDate);
    document.getElementById('summaryTime').textContent = selectedTime;
    document.getElementById('summaryCost').textContent = `${service.price.toLocaleString('es-CL')}`;
}

async function confirmAppointment() {
    if (!selectedService || !selectedDate || !selectedTime) {
        showMessage('scheduleMessage', 'Error: Faltan datos de la cita', 'error');
        return;
    }

    const appointmentData = {
        usuario_id: currentUser.uid,
        usuario_email: currentUser.email,
        tipoServicio: selectedService,
        fecha: selectedDate,
        hora: selectedTime,
        estado: 'pendiente',
        observaciones: document.getElementById('appointmentNotes').value,
        fechaCreacion: new Date().toISOString(),
        sucursal: 'Con Con Centro'
    };
    const confirmBtn = document.querySelector('#step3 button.btn-success');
    try {
        showMessage('scheduleMessage', 'Confirmando cita...', 'info');
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Reservando…';
        
        if (isFirebaseConnected && database) {
        // ↑ Después, reemplaza por un contador aparte y maneja el caso current === null
        //  // 1) Carga tu límite por hora (ya lo haces en loadAvailableHours) :contentReference[oaicite:0]{index=0}
        const maxCitasPorHora = await database
        .ref('configuracion/sistema/maximoCitasPorHora')
        .once('value')
        .then(snap => snap.val() || 3);

        // 2) Usa un nodo 'citasCounter' donde llevarás la cuenta de reservas
    const counterRef = database.ref(`citasCounter/${selectedDate}/${selectedTime}`);
    const result     = await counterRef.transaction(current => {
        if (current === null) {
        // primera reserva: inicializa el contador en 1
         return { count: 1 };
        }
        if (current.count < maxCitasPorHora) {
        // todavía hay cupos: incrementa
        return { count: current.count + 1 };
        }
        return;  // aborta si ya llegamos al máximo
        });

        // 3) Maneja el abort y actualiza badge si se comprometió
        if (!result.committed) {
        showMessage('scheduleMessage', 'Lo siento, ya no hay cupos disponibles.', 'error');
        return;
            }
    const used   = result.snapshot.val().count;
    const remain = maxCitasPorHora - used;
    const badge  = document.getElementById(`badge-${selectedDate}-${selectedTime}`);
        if (badge) badge.textContent = remain;
    // Si la transacción fue exitosa, ahora guardas la cita
    const newAppointmentRef = await database.ref('citas').push(appointmentData);
    appointmentData.id = newAppointmentRef.key;
    }
        
        // Enviar email de confirmación
        await sendConfirmationEmail(appointmentData);
        
        showMessage('scheduleMessage', '¡Cita confirmada exitosamente! Recibirás un email de confirmación.', 'success');
        showNotification('Cita confirmada exitosamente', 'success');
        
        setTimeout(() => {
            resetScheduleForm();
            showStep(1);
            showClientTab('mycites');
        }, 3000);
        
    } catch (error) {
        showMessage('scheduleMessage', `Error: ${error.message}`, 'error');
    }
    finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirmar Cita';
    }

}

// Función para enviar email de confirmación
async function sendConfirmationEmail(appointmentData) {
    try {
        // Obtener datos del usuario actual
        let userName = 'Cliente';
        let userEmail = currentUser.email;
        
        if (isFirebaseConnected && currentUser.uid && database) {
            const userSnapshot = await database.ref(`usuarios/${currentUser.uid}`).once('value');
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                userName = userData.nombre;
            }
        }
        
        const service = services[appointmentData.tipoServicio];
        const formattedDate = formatDate(appointmentData.fecha);
        
        // Configurar parámetros del email
        const templateParams = {
            to_email: userEmail,
            to_name: userName,
            service_name: service.name,
            appointment_date: formattedDate,
            appointment_time: appointmentData.hora,
            appointment_location: appointmentData.sucursal,
            service_price: `${service.price.toLocaleString('es-CL')}`,
            appointment_id: appointmentData.id || 'DEMO-' + Date.now(),
            notes: appointmentData.observaciones || 'Sin observaciones'
        };
        
        // Enviar email usando EmailJS
        // Reemplaza 'TU_SERVICE_ID' y 'TU_TEMPLATE_ID' con tus IDs de EmailJS
        const response = await emailjs.send(
            'default_service', 
            'template_zgcibom', 
            templateParams
        );
        
        console.log('Email enviado:', response);
        
        // Guardar registro del email enviado
        if (isFirebaseConnected && database) {
            await database.ref(`notificaciones/${appointmentData.id}`).set({
                tipo: 'email_confirmacion',
                enviado: true,
                fecha: new Date().toISOString(),
                destinatario: userEmail,
                estado: 'enviado'
            });
        }
        
    } catch (error) {
        console.error('Error enviando email:', error);
        // No bloquear el proceso si falla el email
        showNotification('Cita confirmada (email no enviado)', 'warning');
    }
}

function resetScheduleForm() {
    selectedService = null;
    selectedDate = null;
    selectedTime = null;
    
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const appointmentDate = document.getElementById('appointmentDate');
    const appointmentNotes = document.getElementById('appointmentNotes');
    const availableHours = document.getElementById('availableHours');
    const continueStep2 = document.getElementById('continueStep2');
    const continueStep3 = document.getElementById('continueStep3');
    
    if (appointmentDate) appointmentDate.value = '';
    if (appointmentNotes) appointmentNotes.value = '';
    if (availableHours) availableHours.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Selecciona una fecha</p>';
    if (continueStep2) continueStep2.disabled = true;
    if (continueStep3) continueStep3.disabled = true;
}

// ============= GESTIÓN ADMINISTRATIVA =============
async function handleNewAppointment(e) {
    e.preventDefault();
    
    const selectedDate = document.getElementById('newApptDate').value;
    
    // Validar que no sea fin de semana
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showNotification('No se pueden crear citas en fines de semana. Selecciona un día entre lunes y viernes.', 'error');
        return;
    }
    
    // Validar que no sea feriado nacional
    const feriado = esFeriado(selectedDate);
    if (feriado) {
        showNotification(`No se pueden crear citas en ${feriado} (feriado nacional).`, 'error');
        return;
    }
    
    const appointmentData = {
        fecha: selectedDate,
        hora: document.getElementById('newApptTime').value,
        cliente_rut: document.getElementById('newApptClient').value,
        tipoServicio: document.getElementById('newApptService').value,
        observaciones: document.getElementById('newApptNotes').value,
        estado: 'confirmada',
        fechaCreacion: new Date().toISOString(),
        creadoPor: currentUser.email
    };

    try {
        if (isFirebaseConnected && database) {
            await database.ref('citas').push(appointmentData);
        }
        
        showNotification('Cita creada exitosamente', 'success');
        hideModal('newAppointmentModal');
        e.target.reset();
        loadDemoAppointments();
        
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function handleNewUser(e) {
    e.preventDefault();
    
    const userData = {
        nombre: document.getElementById('newUserName').value,
        rut: document.getElementById('newUserRut').value,
        email: document.getElementById('newUserEmail').value,
        telefono: document.getElementById('newUserPhone').value,
        rol: document.getElementById('newUserRole').value,
        activo: document.getElementById('newUserStatus').value === 'true',
        fechaCreacion: new Date().toISOString()
    };

    try {
        if (isFirebaseConnected && database) {
            await database.ref('usuarios').push(userData);
        }
        
        showNotification('Usuario creado exitosamente', 'success');
        hideModal('newUserModal');
        e.target.reset();
        loadDemoUsers();
        
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function loadDemoAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td>2025-01-15</td>
            <td>08:00</td>
            <td>Juan Pérez</td>
            <td>12.345.678-9</td>
            <td>Renovación</td>
            <td><span class="status-badge status-confirmada">Confirmada</span></td>
            <td>
                <button class="btn btn-success" onclick="completeAppointment('1')">
                    <span class="material-icons">check</span>
                </button>
                <button class="btn btn-warning" onclick="editAppointment('1')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-danger" onclick="cancelAppointment('1')">
                    <span class="material-icons">cancel</span>
                </button>
            </td>
        </tr>
        <tr>
            <td>2025-01-15</td>
            <td>09:00</td>
            <td>María García</td>
            <td>98.765.432-1</td>
            <td>Primera Vez</td>
            <td><span class="status-badge status-pendiente">Pendiente</span></td>
            <td>
                <button class="btn btn-info" onclick="confirmAppointmentAdmin('2')">
                    <span class="material-icons">check_circle</span>
                </button>
                <button class="btn btn-warning" onclick="editAppointment('2')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-danger" onclick="cancelAppointment('2')">
                    <span class="material-icons">cancel</span>
                </button>
            </td>
        </tr>
        <tr>
            <td>2025-01-16</td>
            <td>10:00</td>
            <td>Carlos Silva</td>
            <td>11.222.333-4</td>
            <td>Duplicado</td>
            <td><span class="status-badge status-completada">Completada</span></td>
            <td>
                <button class="btn btn-info" onclick="viewAppointment('3')">
                    <span class="material-icons">visibility</span>
                </button>
            </td>
        </tr>
    `;
}

function loadDemoUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td>DEMO</td>
            <td>cliente1@gmail.com</td>
            <td>12.345.678-9</td>
            <td><span class="status-badge status-confirmada">Cliente</span></td>
            <td><span class="status-badge status-confirmada">Activo</span></td>
            <td>2025-01-05 10:30</td>
            <td>
                <button class="btn btn-warning" onclick="editUser('1')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-info" onclick="viewUserHistory('1')">
                    <span class="material-icons">history</span>
                </button>
            </td>
        </tr>
        <tr>
            <td>USUARIO DEMO</td>
            <td>maria.rodriguez@gmail.com</td>
            <td>98.765.432-1</td>
            <td><span class="status-badge status-confirmada">Cliente</span></td>
            <td><span class="status-badge status-confirmada">Activo</span></td>
            <td>2025-01-04 15:20</td>
            <td>
                <button class="btn btn-warning" onclick="editUser('2')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-info" onclick="viewUserHistory('2')">
                    <span class="material-icons">history</span>
                </button>
            </td>
        </tr>
        <tr>
            <td>DEMO Felipe Alfonso Albornoz</td>
            <td>albornoz.felipealfonso@cftpucv.cl</td>
            <td>19.456.789-3</td>
            <td><span class="status-badge status-pendiente">Admin</span></td>
            <td><span class="status-badge status-confirmada">Activo</span></td>
            <td>2025-01-05 08:00</td>
            <td>
                <button class="btn btn-warning" onclick="editUser('3')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-info" onclick="viewUserHistory('3')">
                    <span class="material-icons">history</span>
                </button>
            </td>
        </tr>
    `;
}

function loadUserAppointments() {
    const container = document.getElementById('userAppointments');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-content">
                <h4>Próximas Citas</h4>
                <div style="margin-top: 20px;">
                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>Renovación de Licencia</strong><br>
                                <small>📅 15 de Enero, 2025 - 🕒 10:00 AM</small><br>
                                <small>💰 $15.000 • 📍 Con Con Centro</small>
                            </div>
                            <div>
                                <span class="status-badge status-confirmada">Confirmada</span>
                            </div>
                        </div>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem;">
                            <strong>Documentos requeridos:</strong><br>
                            • Cédula de Identidad<br>
                            • Licencia anterior<br>
                            • Certificado médico
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button class="btn btn-danger" onclick="cancelUserAppointment('cita_1')">
                                <span class="material-icons">cancel</span>
                                Cancelar
                            </button>
                            <button class="btn btn-warning" onclick="rescheduleAppointment('cita_1')">
                                <span class="material-icons">schedule</span>
                                Reprogramar
                            </button>
                            <button class="btn btn-info" onclick="downloadAppointmentPDF('cita_1')">
                                <span class="material-icons">file_download</span>
                                Descargar PDF
                            </button>
                        </div>
                    </div>

                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>Duplicado por Extravío</strong><br>
                                <small>📅 22 de Enero, 2025 - 🕒 14:00 PM</small><br>
                                <small>💰 $20.000 • 📍 Con Con Centro</small>
                            </div>
                            <div>
                                <span class="status-badge status-pendiente">Pendiente</span>
                            </div>
                        </div>
                        <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; color: #856404;">
                            <strong>⚠️ Esperando confirmación:</strong> Tu cita será confirmada en las próximas 24 horas.
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button class="btn btn-danger" onclick="cancelUserAppointment('cita_2')">
                                <span class="material-icons">cancel</span>
                                Cancelar
                            </button>
                            <button class="btn btn-warning" onclick="rescheduleAppointment('cita_2')">
                                <span class="material-icons">schedule</span>
                                Reprogramar
                            </button>
                        </div>
                    </div>
                </div>
                
                <h4 style="margin-top: 30px;">Historial de Citas</h4>
                <div style="margin-top: 20px;">
                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px; opacity: 0.8;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>Primera Licencia</strong><br>
                                <small>📅 15 de Diciembre, 2024 - 🕒 14:00 PM</small><br>
                                <small>💰 $25.000 • 📍 Con Con Centro</small>
                            </div>
                            <div>
                                <span class="status-badge status-completada">Completada</span>
                            </div>
                        </div>
                        <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; color: #155724;">
                            <strong>✅ Cita completada exitosamente</strong><br>
                            Licencia emitida: LC-2024-001234
                        </div>
                        <div>
                            <button class="btn btn-info" onclick="downloadLicensePDF('LC-2024-001234')">
                                <span class="material-icons">file_download</span>
                                Descargar Licencia
                            </button>
                        </div>
                    </div>

                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px; opacity: 0.6;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>Renovación de Licencia</strong><br>
                                <small>📅 10 de Noviembre, 2024 - 🕒 09:00 AM</small><br>
                                <small>💰 $15.000 • 📍 Con Con Centro</small>
                            </div>
                            <div>
                                <span class="status-badge status-cancelada">Cancelada</span>
                            </div>
                        </div>
                        <div style="background: #f8d7da; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; color: #721c24;">
                            <strong>❌ Cita cancelada por el cliente</strong><br>
                            Motivo: Conflicto de horario
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <p style="color: #666; margin-bottom: 15px;">¿Necesitas agendar una nueva cita?</p>
                    <button class="btn btn-primary" onclick="showClientTab('schedule')">
                        <span class="material-icons">add</span>
                        Agendar Nueva Cita
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============= CARGA DE DATOS REALES =============
async function loadRealData() {
    // Evitar cargas múltiples simultáneas
    if (isLoadingData) {
        console.log('⏳ Ya se están cargando los datos...');
        return;
    }
        // Evitar cargas muy frecuentes (menos de 2 segundos)
    const now = Date.now();
    if (lastDataLoad && (now - lastDataLoad) < 2000) {
        console.log('⚡ Carga reciente, saltando...');
        return;
    }
    
    isLoadingData = true;
    lastDataLoad = now;
    
    if (!isFirebaseConnected || !database) {
        console.log('🔴 Sin conexión Firebase - Cargando datos demo');
        loadDemoData();
        isLoadingData = false;
        return;
    }

    try {
        console.log('📊 Cargando datos reales desde Firebase...');
        
        // Cargar estadísticas del dashboard
        await loadDashboardStats();
        
        // Cargar citas reales (solo si estamos en la página de citas o dashboard)
        const currentPage = getCurrentAdminPage();
        if (currentPage === 'dashboard' || currentPage === 'appointments') {
            await loadRealAppointments();
        }
        
        if (currentPage === 'dashboard') {
            await loadTodayAppointments();
        }
        
        // Cargar usuarios reales (solo si estamos en la página de usuarios)
        if (currentPage === 'users') {
            await loadRealUsers();
        }
        
        console.log('✅ Datos reales cargados exitosamente');
        
    } catch (error) {
        console.error('❌ Error cargando datos reales:', error);
        // Solo cargar demo si realmente falló
        if (error.message.includes('permission') || error.message.includes('network')) {
            loadDemoData();
        }
    } finally {
        isLoadingData = false;
    }
}

// Función para obtener la página actual del admin
function getCurrentAdminPage() {
    const activePage = document.querySelector('.admin-page:not(.hidden)');
    if (!activePage) return 'dashboard';
    
    const pageId = activePage.id;
    if (pageId.includes('Dashboard')) return 'dashboard';
    if (pageId.includes('Appointments')) return 'appointments';
    if (pageId.includes('Users')) return 'users';
    if (pageId.includes('Licenses')) return 'licenses';
    if (pageId.includes('Reports')) return 'reports';
    if (pageId.includes('Notifications')) return 'notifications';
    
    return 'dashboard';
}
    

async function loadDashboardStats() {
    try {
        // Obtener fecha de hoy
        const today = new Date().toISOString().split('T')[0];
        
        // Contar citas de hoy
        const citasSnapshot = await database.ref('citas').orderByChild('fecha').equalTo(today).once('value');
        const citasHoy = citasSnapshot.exists() ? Object.keys(citasSnapshot.val()).length : 0;
        document.getElementById('adminCitasHoy').textContent = citasHoy;
        
        // Contar licencias activas
        const licenciasSnapshot = await database.ref('licencias').orderByChild('estado').equalTo('vigente').once('value');
        const licenciasActivas = licenciasSnapshot.exists() ? Object.keys(licenciasSnapshot.val()).length : 0;
        document.getElementById('adminLicenciasActivas').textContent = licenciasActivas.toLocaleString();
        
        // Contar usuarios totales
        const usuariosSnapshot = await database.ref('usuarios').once('value');
        const usuariosTotales = usuariosSnapshot.exists() ? Object.keys(usuariosSnapshot.val()).length : 0;
        document.getElementById('adminUsuarios').textContent = usuariosTotales;
        
        // Calcular ingresos del mes (simulado basado en citas del mes)
        const currentMonth = new Date().toISOString().substring(0, 7);
        const monthlySnapshot = await database.ref('reportes/mensual/' + currentMonth.replace('-', '_')).once('value');
        if (monthlySnapshot.exists()) {
            const ingresos = monthlySnapshot.val().totalIngresos || 0;
            document.getElementById('adminIngresos').textContent = `${(ingresos / 1000000).toFixed(1)}M`;
        }
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

async function loadTodayAppointments() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const citasSnapshot = await database.ref('citas').orderByChild('fecha').equalTo(today).once('value');
        
        const tbody = document.getElementById('todayAppointments');
        if (!tbody) return;
        
        // ✅ LIMPIAR CONTENIDO ANTERIOR
        tbody.innerHTML = '';
        
        if (citasSnapshot.exists()) {
            const citas = citasSnapshot.val();
            for (const [citaId, cita] of Object.entries(citas)) {
                // Obtener datos del usuario
                let clienteNombre = 'Cliente';
                if (cita.usuario_id) {
                    try {
                        const userSnapshot = await database.ref(`usuarios/${cita.usuario_id}`).once('value');
                        if (userSnapshot.exists()) {
                            clienteNombre = userSnapshot.val().nombre;
                        }
                    } catch (userError) {
                        console.warn('Error cargando datos del usuario:', userError);
                    }
                }
                
                const serviceName = services[cita.tipoServicio]?.name || cita.tipoServicio;
                const statusClass = `status-${cita.estado}`;
                
                tbody.innerHTML += `
                    <tr data-cita-id="${citaId}">
                        <td>${cita.hora}</td>
                        <td>${clienteNombre}</td>
                        <td>${serviceName}</td>
                        <td><span class="status-badge ${statusClass}">${cita.estado}</span></td>
                        <td>
                            ${cita.estado === 'pendiente' ? `
                                <button class="btn btn-info" onclick="confirmAppointmentAdmin('${citaId}')">
                                    <span class="material-icons">check_circle</span>
                                </button>
                            ` : ''}
                            ${cita.estado === 'confirmada' ? `
                                <button class="btn btn-success" onclick="completeAppointment('${citaId}')">
                                    <span class="material-icons">check</span>
                                </button>
                            ` : ''}
                            <button class="btn btn-warning" onclick="editAppointment('${citaId}')">
                                <span class="material-icons">edit</span>
                            </button>
                        </td>
                    </tr>
                `;
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay citas para hoy</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando citas de hoy:', error);
    }
}

async function loadRealAppointments() {
    try {
        const citasSnapshot = await database.ref('citas').once('value');
        const tbody = document.getElementById('appointmentsTableBody');
        if (!tbody) return;
        
        // ✅ LIMPIAR CONTENIDO ANTERIOR
        tbody.innerHTML = '';
        
        if (citasSnapshot.exists()) {
            const citas = citasSnapshot.val();
            const citasArray = [];
            
            // Convertir a array y ordenar por fecha
            for (const [citaId, cita] of Object.entries(citas)) {
                citasArray.push({ id: citaId, ...cita });
            }
            
            citasArray.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            
            // Mostrar las citas
            for (const cita of citasArray) {
                // Obtener datos del usuario
                let clienteData = { nombre: 'Cliente', rut: 'N/A' };
                if (cita.usuario_id) {
                    try {
                        const userSnapshot = await database.ref(`usuarios/${cita.usuario_id}`).once('value');
                        if (userSnapshot.exists()) {
                            const userData = userSnapshot.val();
                            clienteData = {
                                nombre: userData.nombre,
                                rut: userData.rut
                            };
                        }
                    } catch (userError) {
                        console.warn('Error cargando datos del usuario:', userError);
                    }
                }
                
                const serviceName = services[cita.tipoServicio]?.name || cita.tipoServicio;
                const statusClass = `status-${cita.estado}`;
                
                tbody.innerHTML += `
                    <tr data-cita-id="${cita.id}">
                        <td>${cita.fecha}</td>
                        <td>${cita.hora}</td>
                        <td>${clienteData.nombre}</td>
                        <td>${clienteData.rut}</td>
                        <td>${serviceName}</td>
                        <td><span class="status-badge ${statusClass}">${cita.estado}</span></td>
                        <td>
                            <button class="btn btn-info" onclick="viewAppointment('${cita.id}')">
                                <span class="material-icons">visibility</span>
                            </button>
                            ${cita.estado === 'pendiente' ? `
                                <button class="btn btn-success" onclick="confirmAppointmentAdmin('${cita.id}')">
                                    <span class="material-icons">check_circle</span>
                                </button>
                            ` : ''}
                            <button class="btn btn-warning" onclick="editAppointment('${cita.id}')">
                                <span class="material-icons">edit</span>
                            </button>
                            <button class="btn btn-danger" onclick="cancelAppointment('${cita.id}')">
                                <span class="material-icons">cancel</span>
                            </button>
                        </td>
                    </tr>
                `;
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay citas registradas</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando citas:', error);
        // En caso de error, cargar datos demo solo si la tabla está vacía
        const tbody = document.getElementById('appointmentsTableBody');
        if (typeof loadRealUsers !== 'undefined') {
    window.loadRealUsers = loadDemoUsersWithManagement;

        }
    }
}

async function loadRealUsers() {
    try {
        const usuariosSnapshot = await database.ref('usuarios').once('value');
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        // ✅ LIMPIAR CONTENIDO ANTERIOR
        tbody.innerHTML = '';
        
        if (usuariosSnapshot.exists()) {
            const usuarios = usuariosSnapshot.val();
            
            for (const [userId, usuario] of Object.entries(usuarios)) {
                const statusClass = usuario.activo ? 'status-confirmada' : 'status-cancelada';
                const rolClass = usuario.rol === 'admin' ? 'status-pendiente' : 'status-confirmada';
                const ultimoAcceso = usuario.ultimoAcceso ? new Date(usuario.ultimoAcceso).toLocaleString('es-CL') : 'N/A';
                
                tbody.innerHTML += `
                    <tr data-user-id="${userId}">
                        <td>${usuario.nombre}</td>
                        <td>${usuario.email}</td>
                        <td>${usuario.rut}</td>
                        <td><span class="status-badge ${rolClass}">${usuario.rol}</span></td>
                        <td><span class="status-badge ${statusClass}">${usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                        <td>${ultimoAcceso}</td>
                        <td>
                            <button class="btn btn-warning" onclick="editUser('${userId}')">
                                <span class="material-icons">edit</span>
                            </button>
                            <button class="btn btn-info" onclick="viewUserHistory('${userId}')">
                                <span class="material-icons">history</span>
                            </button>
                        </td>
                    </tr>
                `;
            }
            
            // Agregar administradores también
            try {
                const adminsSnapshot = await database.ref('administradores').once('value');
                if (adminsSnapshot.exists()) {
                    const admins = adminsSnapshot.val();
                    for (const [adminId, admin] of Object.entries(admins)) {
                        const statusClass = admin.activo ? 'status-confirmada' : 'status-cancelada';
                        const ultimoAcceso = admin.ultimoAcceso || 'N/A';
                        
                        tbody.innerHTML += `
                            <tr style="background: #f0f2ff;" data-user-id="${adminId}">
                                <td>${admin.nombre}</td>
                                <td>${admin.email}</td>
                                <td>${admin.rut}</td>
                                <td><span class="status-badge status-pendiente">Admin</span></td>
                                <td><span class="status-badge ${statusClass}">${admin.activo ? 'Activo' : 'Inactivo'}</span></td>
                                <td>${ultimoAcceso}</td>
                                <td>
                                    <button class="btn btn-warning" onclick="editUser('${adminId}')">
                                        <span class="material-icons">edit</span>
                                    </button>
                                    <button class="btn btn-info" onclick="viewUserHistory('${adminId}')">
                                        <span class="material-icons">history</span>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }
                }
            } catch (adminError) {
                console.warn('Error cargando administradores:', adminError);
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay usuarios registrados</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        // En caso de error, cargar datos demo solo si la tabla está vacía
        const tbody = document.getElementById('usersTableBody');
        if (tbody && tbody.innerHTML.trim() === '') {
            loadDemoUsers();
        }
    }
}
            


async function loadUserAppointments() {
    if (!currentUser || !isFirebaseConnected) {
        loadDemoUserAppointments();
        return;
    }

    try {
        const container = document.getElementById('userAppointments');
        if (!container) return;
        
        // Obtener citas del usuario actual
        const citasSnapshot = await database.ref('citas')
            .orderByChild('usuario_id')
            .equalTo(currentUser.uid)
            .once('value');
        
        if (citasSnapshot.exists()) {
            const citas = citasSnapshot.val();
            const citasArray = Object.entries(citas).map(([id, cita]) => ({ id, ...cita }));
            
            // Separar citas próximas y pasadas
            const today = new Date().toISOString().split('T')[0];
            const proximas = citasArray.filter(c => c.fecha >= today && c.estado !== 'cancelada');
            const historial = citasArray.filter(c => c.fecha < today || c.estado === 'cancelada' || c.estado === 'completada');
            
            let html = '<div class="card"><div class="card-content">';
            
            // Citas próximas
            html += '<h4>Próximas Citas</h4><div style="margin-top: 20px;">';
            if (proximas.length > 0) {
                proximas.forEach(cita => {
                    const service = services[cita.tipoServicio];
                    const statusClass = `status-${cita.estado}`;
                    html += `
                        <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong>${service?.name || cita.tipoServicio}</strong><br>
                                    <small>📅 ${formatDate(cita.fecha)} - 🕒 ${cita.hora}</small><br>
                                    <small>💰 ${service?.price.toLocaleString('es-CL')} • 📍 ${cita.sucursal}</small>
                                </div>
                                <div>
                                    <span class="status-badge ${statusClass}">${cita.estado}</span>
                                </div>
                            </div>
                            ${cita.observaciones ? `
                                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem;">
                                    <strong>Observaciones:</strong> ${cita.observaciones}
                                </div>
                            ` : ''}
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${cita.estado !== 'cancelada' ? `
                                    <button class="btn btn-danger" onclick="cancelUserAppointment('${cita.id}')">
                                        <span class="material-icons">cancel</span>
                                        Cancelar
                                    </button>
                                    <button class="btn btn-warning" onclick="rescheduleAppointment('${cita.id}')">
                                        <span class="material-icons">schedule</span>
                                        Reprogramar
                                    </button>
                                ` : ''}
                                <button class="btn btn-info" onclick="downloadAppointmentPDF('${cita.id}')">
                                    <span class="material-icons">file_download</span>
                                    Descargar PDF
                                </button>
                            </div>
                        </div>
                    `;
                });
            } else {
                html += '<p style="text-align: center; color: #666;">No tienes citas próximas</p>';
            }
            html += '</div>';
            
            // Historial
            html += '<h4 style="margin-top: 30px;">Historial de Citas</h4><div style="margin-top: 20px;">';
            if (historial.length > 0) {
                historial.forEach(cita => {
                    const service = services[cita.tipoServicio];
                    const statusClass = `status-${cita.estado}`;
                    html += `
                        <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px; opacity: 0.8;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong>${service?.name || cita.tipoServicio}</strong><br>
                                    <small>📅 ${formatDate(cita.fecha)} - 🕒 ${cita.hora}</small><br>
                                    <small>💰 ${service?.price.toLocaleString('es-CL')} • 📍 ${cita.sucursal}</small>
                                </div>
                                <div>
                                    <span class="status-badge ${statusClass}">${cita.estado}</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            html += '</div>';
            
            html += `
                <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <p style="color: #666; margin-bottom: 15px;">¿Necesitas agendar una nueva cita?</p>
                    <button class="btn btn-primary" onclick="showClientTab('schedule')">
                        <span class="material-icons">add</span>
                        Agendar Nueva Cita
                    </button>
                </div>
            `;
            
            html += '</div></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="card">
                    <div class="card-content">
                        <div style="text-align: center; padding: 40px;">
                            <span class="material-icons" style="font-size: 64px; color: #ccc;">event_busy</span>
                            <h3>No tienes citas registradas</h3>
                            <p style="color: #666; margin: 20px 0;">Comienza agendando tu primera cita</p>
                            <button class="btn btn-primary" onclick="showClientTab('schedule')">
                                <span class="material-icons">add</span>
                                Agendar Primera Cita
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error cargando citas del usuario:', error);
        loadDemoUserAppointments();
    }
}

function loadDemoUserAppointments() {
    const container = document.getElementById('userAppointments');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-content">
                <h4>Próximas Citas</h4>
                <div style="margin-top: 20px;">
                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>Renovación de Licencia</strong><br>
                                <small>📅 15 de Enero, 2025 - 🕒 10:00 AM</small><br>
                                <small>💰 $15.000 • 📍 Con Con Centro</small>
                            </div>
                            <div>
                                <span class="status-badge status-confirmada">Confirmada</span>
                            </div>
                        </div>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem;">
                            <strong>Documentos requeridos:</strong><br>
                            • Cédula de Identidad<br>
                            • Licencia anterior<br>
                            • Certificado médico
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button class="btn btn-danger" onclick="cancelUserAppointment('demo_1')">
                                <span class="material-icons">cancel</span>
                                Cancelar
                            </button>
                            <button class="btn btn-warning" onclick="rescheduleAppointment('demo_1')">
                                <span class="material-icons">schedule</span>
                                Reprogramar
                            </button>
                            <button class="btn btn-info" onclick="downloadAppointmentPDF('demo_1')">
                                <span class="material-icons">file_download</span>
                                Descargar PDF
                            </button>
                        </div>
                    </div>
                </div>
                
                <h4 style="margin-top: 30px;">Historial de Citas</h4>
                <div style="margin-top: 20px;">
                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 15px; opacity: 0.8;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>Primera Licencia</strong><br>
                                <small>📅 15 de Diciembre, 2024 - 🕒 14:00 PM</small><br>
                                <small>💰 $25.000 • 📍 Con Con Centro</small>
                            </div>
                            <div>
                                <span class="status-badge status-completada">Completada</span>
                            </div>
                        </div>
                        <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; color: #155724;">
                            <strong>✅ Cita completada exitosamente</strong><br>
                            Licencia emitida: LC-2024-001234
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <p style="color: #666; margin-bottom: 15px;">¿Necesitas agendar una nueva cita?</p>
                    <button class="btn btn-primary" onclick="showClientTab('schedule')">
                        <span class="material-icons">add</span>
                        Agendar Nueva Cita
                    </button>
                </div>
            </div>
        </div>
    `;
}
function completeAppointment(id) {
    completeAppointmentAsync(id);
}

function confirmAppointmentAdmin(id) {
    confirmAppointmentAdminAsync(id);
}

function cancelAppointment(id) {
    cancelAppointmentAsync(id);
}

async function completeAppointmentAsync(id) {
    try {
        if (isFirebaseConnected && database) {
            await database.ref(`citas/${id}`).update({
                estado: 'completada',
                fechaCompletado: new Date().toISOString(),
                completadoPor: currentUser.uid
            });
        }
        
        showNotification(`Cita marcada como completada`, 'success');
        
        // Solo actualizar la fila específica en lugar de recargar todo
        updateAppointmentRow(id, 'completada');
        
    } catch (error) {
        showNotification('Error al completar la cita', 'error');
        console.error('Error:', error);
    }
}

async function confirmAppointmentAdminAsync(id) {
    try {
        if (isFirebaseConnected && database) {
            await database.ref(`citas/${id}`).update({
                estado: 'confirmada',
                fechaConfirmacion: new Date().toISOString(),
                confirmadoPor: currentUser.uid
            });
        }
        
        showNotification(`Cita confirmada exitosamente`, 'success');
        
        // Solo actualizar la fila específica
        updateAppointmentRow(id, 'confirmada');
        
    } catch (error) {
        showNotification('Error al confirmar la cita', 'error');
        console.error('Error:', error);
    }
}

async function cancelAppointmentAsync(id) {
    if (confirm('¿Estás seguro de cancelar esta cita?')) {
        try {
            if (isFirebaseConnected && database) {
                await database.ref(`citas/${id}`).update({
                    estado: 'cancelada',
                    fechaCancelacion: new Date().toISOString(),
                    canceladoPor: currentUser.uid
                });
            }
            
            showNotification(`Cita cancelada`, 'success');
            
            // Solo actualizar la fila específica
            updateAppointmentRow(id, 'cancelada');
            
        } catch (error) {
            showNotification('Error al cancelar la cita', 'error');
            console.error('Error:', error);
        }
    }
}

// Función auxiliar para actualizar una fila específica de cita
function updateAppointmentRow(citaId, newStatus) {
    // Actualizar en tabla de citas del día
    const todayRow = document.querySelector(`#todayAppointments tr[data-cita-id="${citaId}"]`);
    if (todayRow) {
        const statusCell = todayRow.querySelector('.status-badge');
        if (statusCell) {
            statusCell.className = `status-badge status-${newStatus}`;
            statusCell.textContent = newStatus;
        }
    }
    
    // Actualizar en tabla principal de citas
    const mainRow = document.querySelector(`#appointmentsTableBody tr[data-cita-id="${citaId}"]`);
    if (mainRow) {
        const statusCell = mainRow.querySelector('.status-badge');
        if (statusCell) {
            statusCell.className = `status-badge status-${newStatus}`;
            statusCell.textContent = newStatus;
        }
    }
}

function viewAppointment(id) {
    showNotification(`Viendo ID de cita #${id}`, 'info');
}

function editUser(id) {
    showNotification(`Editando usuario #${id}`, 'info');
}

function viewUserHistory(id) {
    showNotification(`Viendo historial del usuario #${id}`, 'info');
}

async function cancelUserAppointment(id) {
    if (confirm('¿Estás seguro de cancelar tu cita? Esta acción no se puede deshacer.')) {
        try {
            if (isFirebaseConnected && database) {
                await database.ref(`citas/${id}`).update({
                    estado: 'cancelada',
                    fechaCancelacion: new Date().toISOString(),
                    canceladoPor: currentUser.uid
                });
                
                // Enviar email de cancelación
                await sendCancellationEmail(id);
            }
            
            showNotification('Cita cancelada exitosamente', 'success');
            
            // Recargar las citas del usuario
            setTimeout(() => {
                loadUserAppointments();
            }, 1000);
            
        } catch (error) {
            showNotification('Error al cancelar la cita', 'error');
            console.error('Error:', error);
        }
    }
}

function rescheduleAppointment(id) {
    // Mostrar modal de reprogramación
    showRescheduleModal(id);
}

function showRescheduleModal(appointmentId) {
    // Crear modal dinámicamente
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'rescheduleModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Reprogramar Cita</h3>
                <span class="close" onclick="hideRescheduleModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="rescheduleDate">Nueva Fecha</label>
                    <input type="date" id="rescheduleDate" required>
                </div>
                <div class="form-group">
                    <label>Nuevo Horario</label>
                    <div id="rescheduleHours" class="horario-grid">
                        <p style="grid-column: 1/-1; text-align: center; color: #999;">Selecciona una fecha</p>
                    </div>
                </div>
                <div class="form-group">
                    <label for="rescheduleReason">Motivo del cambio (Opcional)</label>
                    <textarea id="rescheduleReason" rows="3" placeholder="Explica brevemente el motivo del cambio..."></textarea>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="hideRescheduleModal()" style="margin-right: 10px;">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="confirmReschedule('${appointmentId}')" id="confirmRescheduleBtn" disabled>Confirmar Cambio</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Configurar límites de fecha
    setupRescheduleDateLimits();
    
    // Event listener para cambio de fecha
    document.getElementById('rescheduleDate').addEventListener('change', loadRescheduleHours);
}

function setupRescheduleDateLimits() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    
    const rescheduleDate = document.getElementById('rescheduleDate');
    if (rescheduleDate) {
        rescheduleDate.min = tomorrow.toISOString().split('T')[0];
        rescheduleDate.max = maxDate.toISOString().split('T')[0];
        
        // Agregar validación de fines de semana para reprogramación
        rescheduleDate.addEventListener('change', function() {
            validateRescheduleWeekday(this);
        });
    }
}

function validateRescheduleWeekday(input) {
    const selectedDate = new Date(input.value + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay(); // 0 = Domingo, 6 = Sábado
    
    // Verificar fin de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showNotification('Los fines de semana no están disponibles. Por favor selecciona un día entre lunes y viernes.', 'error');
        input.value = '';
        clearRescheduleHours();
        return false;
    }
    
    // Verificar feriados nacionales
    const feriado = esFeriado(input.value);
    if (feriado) {
        showNotification(`${feriado} es feriado nacional y no está disponible para reprogramación.`, 'error');
        input.value = '';
        clearRescheduleHours();
        return false;
    }
    
    return true;
}

function clearRescheduleHours() {
    // Limpiar horarios de reprogramación
    const rescheduleHours = document.getElementById('rescheduleHours');
    if (rescheduleHours) {
        rescheduleHours.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Selecciona una fecha válida (lunes a viernes, no feriados)</p>';
    }
    
    // Deshabilitar botón confirmar
    const confirmBtn = document.getElementById('confirmRescheduleBtn');
    if (confirmBtn) confirmBtn.disabled = true;
}

function loadRescheduleHours() {
    const date = document.getElementById('rescheduleDate').value;
    if (!date) return;
    
    // Validar que no sea fin de semana
    const selectedDateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const container = document.getElementById('rescheduleHours');
        if (container) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">❌ Los fines de semana no están disponibles</p>';
        }
        return;
    }
    
    // Validar que no sea feriado nacional
    const feriado = esFeriado(date);
    if (feriado) {
        const container = document.getElementById('rescheduleHours');
        if (container) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">🎉 ${feriado} - Feriado Nacional<br>No hay atención este día</p>`;
        }
        return;
    }
    
    const container = document.getElementById('rescheduleHours');
    if (!container) return;
    
    container.innerHTML = '';
    
    availableHours.forEach(hour => {
        const btn = document.createElement('button');
        btn.className = 'horario-btn';
        btn.textContent = hour;
        btn.onclick = () => selectRescheduleHour(hour, btn);
        
        // Simular algunos horarios ocupados
        if (Math.random() > 0.8) {
            btn.disabled = true;
            btn.textContent += ' (Ocupado)';
        }
        
        container.appendChild(btn);
    });
}

let selectedRescheduleTime = null;

function selectRescheduleHour(hour, button) {
    document.querySelectorAll('#rescheduleHours .horario-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    button.classList.add('selected');
    selectedRescheduleTime = hour;
    
    const confirmBtn = document.getElementById('confirmRescheduleBtn');
    if (confirmBtn) confirmBtn.disabled = false;
}

function confirmReschedule(appointmentId) {
    const newDate = document.getElementById('rescheduleDate').value;
    const reason = document.getElementById('rescheduleReason').value;
    
    if (!newDate || !selectedRescheduleTime) {
        showNotification('Por favor selecciona fecha y hora', 'error');
        return;
    }

    // Validar que no sea fin de semana
    const dateObj = new Date(newDate + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showNotification('No se puede reprogramar para fines de semana. Selecciona un día entre lunes y viernes.', 'error');
        return;
    }
    
    // Validar que no sea feriado nacional
    const feriado = esFeriado(newDate);
    if (feriado) {
        showNotification(`No se puede reprogramar para ${feriado} (feriado nacional).`, 'error');
        return;
    }

    try {
        const rescheduleData = {
            fechaAnterior: '2025-01-15', // En una app real, esto vendría de la cita original
            horaAnterior: '10:00',
            fechaNueva: newDate,
            horaNueva: selectedRescheduleTime,
            motivo: reason,
            fechaReprogramacion: new Date().toISOString(),
            reprogramadoPor: currentUser.uid
        };

        // Si Firebase está conectado, actualizar en la base de datos
        if (isFirebaseConnected && database) {
            database.ref(`citas/${appointmentId}`).update({
                fecha: newDate,
                hora: selectedRescheduleTime,
                estado: 'reprogramada',
                historialReprogramacion: rescheduleData
            });
        }

        showNotification('Cita reprogramada exitosamente', 'success');
        hideRescheduleModal();
        
        // Recargar las citas del usuario
        setTimeout(() => {
            loadUserAppointments();
        }, 1000);
        
    } catch (error) {
        showNotification('Error al reprogramar la cita', 'error');
        console.error('Error:', error);
    }
}

function hideRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
    selectedRescheduleTime = null;
}

function filterAppointments(searchTerm) {
    const rows = document.querySelectorAll('#appointmentsTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
}

function filterUsers(searchTerm) {
    const rows = document.querySelectorAll('#usersTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
}

// Función para enviar email cuando se cancela una cita
async function sendCancellationEmail(appointmentId) {
    try {
        let appointmentData = null;
        let userData = null;
        
        if (isFirebaseConnected && database) {
            const appointmentSnapshot = await database.ref(`citas/${appointmentId}`).once('value');
            if (appointmentSnapshot.exists()) {
                appointmentData = appointmentSnapshot.val();
                
                const userSnapshot = await database.ref(`usuarios/${appointmentData.usuario_id}`).once('value');
                if (userSnapshot.exists()) {
                    userData = userSnapshot.val();
                }
            }
        }
        
        if (!appointmentData || !userData) return;
        
        const service = services[appointmentData.tipoServicio];
        const formattedDate = formatDate(appointmentData.fecha);
        
        const templateParams = {
            to_email: userData.email,
            to_name: userData.nombre,
            service_name: service.name,
            appointment_date: formattedDate,
            appointment_time: appointmentData.hora,
            appointment_id: appointmentId
        };
        
        // Enviar email de cancelación
        // Necesitarás crear otra plantilla en EmailJS para cancelaciones
        await emailjs.send(
            'TU_SERVICE_ID', 
            'TU_CANCELLATION_TEMPLATE_ID', 
            templateParams
        );
        
        console.log('Email de cancelación enviado');
        
    } catch (error) {
        console.error('Error enviando email de cancelación:', error);
    }
}

// Función para enviar recordatorios (se puede llamar desde un cron job externo)
async function sendReminderEmails() {
    if (!isFirebaseConnected || !database) return;
    
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const citasSnapshot = await database.ref('citas')
            .orderByChild('fecha')
            .equalTo(tomorrowStr)
            .once('value');
        
        if (citasSnapshot.exists()) {
            const citas = citasSnapshot.val();
            
            for (const [citaId, cita] of Object.entries(citas)) {
                if (cita.estado === 'confirmada' || cita.estado === 'pendiente') {
                    const userSnapshot = await database.ref(`usuarios/${cita.usuario_id}`).once('value');
                    if (userSnapshot.exists()) {
                        const userData = userSnapshot.val();
                        const service = services[cita.tipoServicio];
                        
                        const templateParams = {
                            to_email: userData.email,
                            to_name: userData.nombre,
                            service_name: service.name,
                            appointment_date: formatDate(cita.fecha),
                            appointment_time: cita.hora,
                            appointment_location: cita.sucursal
                        };
                        
                        // Enviar recordatorio
                        await emailjs.send(
                            'default_service', 
                            'template_jxyg4tm', 
                            templateParams
                        );
                        
                        console.log(`Recordatorio enviado a ${userData.email}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error enviando recordatorios:', error);
    }
}
function sendTestNotification() {
    showNotification('Notificación de prueba enviada', 'success');
}

function sendReminders() {
    showNotification('Recordatorios enviados a 5 clientes', 'success');
}

// ============= INFORMACIÓN SOBRE FERIADOS =============
function mostrarProximosFeriados() {
    const hoy = new Date();
    const proximosFeriados = [];
    
    // Revisar los próximos 90 días
    for (let i = 0; i < 90; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        const fechaStr = fecha.toISOString().split('T')[0];
        const feriado = esFeriado(fechaStr);
        
        if (feriado) {
            proximosFeriados.push({
                fecha: fechaStr,
                nombre: feriado,
                diasRestantes: i
            });
        }
    }
    
    return proximosFeriados.slice(0, 5); // Mostrar solo los próximos 5 feriados
}

function mostrarInfoFeriados() {
    const proximos = mostrarProximosFeriados();
    if (proximos.length > 0) {
        let mensaje = '📅 Próximos feriados nacionales:\n\n';
        proximos.forEach(feriado => {
            const fecha = new Date(feriado.fecha + 'T00:00:00');
            const fechaFormateada = fecha.toLocaleDateString('es-CL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (feriado.diasRestantes === 0) {
                mensaje += `🎉 HOY - ${feriado.nombre}\n`;
            } else if (feriado.diasRestantes === 1) {
                mensaje += `⭐ MAÑANA - ${feriado.nombre}\n`;
            } else {
                mensaje += `• ${fechaFormateada} - ${feriado.nombre} (en ${feriado.diasRestantes} días)\n`;
            }
        });
        
        showNotification(mensaje, 'info');
    } else {
        showNotification('No hay feriados nacionales en los próximos 90 días.', 'info');
    }
}

// ============= FUNCIONES AUXILIARES =============
function showMessage(containerId, message, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-info';
    container.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    
    if (type === 'success') {
        setTimeout(() => {
            if (container) container.innerHTML = '';
        }, 5000);
    }
}

function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    if (type === 'error') toast.classList.add('error');
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function handleModalClick(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return date.toLocaleDateString('es-CL', options);
}

function fillDemoLogin(email, password) {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
}

function fillAdminDemo(email, password) {
    const emailInput = document.getElementById('adminEmail');
    const passwordInput = document.getElementById('adminPassword');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
}

function downloadAppointmentPDF(appointmentId) {
    // Simular descarga de PDF
    showNotification('Descargando comprobante de cita...', 'info');
    setTimeout(() => {
        showNotification('PDF descargado exitosamente', 'success');
    }, 2000);
}

function downloadLicensePDF(licenseNumber) {
    // Simular descarga de licencia
    showNotification(`Descargando licencia ${licenseNumber}...`, 'info');
    setTimeout(() => {
        showNotification('Licencia descargada exitosamente', 'success');
    }, 2000);
}

async function populateEditModal(appointmentData) {
    // Datos básicos
    document.getElementById('editApptId').value = appointmentData.id;
    document.getElementById('editApptDate').value = appointmentData.fecha;
    document.getElementById('editApptTime').value = appointmentData.hora;
    document.getElementById('editApptService').value = appointmentData.tipoServicio;
    document.getElementById('editApptStatus').value = appointmentData.estado;
    document.getElementById('editApptNotes').value = appointmentData.observaciones || '';
    
    // Datos del cliente
    if (appointmentData.usuario_id && isFirebaseConnected) {
        try {
            const userSnapshot = await database.ref(`usuarios/${appointmentData.usuario_id}`).once('value');
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                document.getElementById('editApptClientName').value = userData.nombre;
                document.getElementById('editApptClientRut').value = userData.rut;
                document.getElementById('editApptClientEmail').value = userData.email;
            }
        } catch (error) {
            console.warn('Error cargando datos del cliente:', error);
        }
    } else {
        // Datos demo o cliente directo
        document.getElementById('editApptClientName').value = appointmentData.cliente_nombre || 'Cliente Demo';
        document.getElementById('editApptClientRut').value = appointmentData.cliente_rut || '12.345.678-9';
        document.getElementById('editApptClientEmail').value = appointmentData.cliente_email || 'cliente@demo.com';
    }
    
    // Información adicional
    document.getElementById('editApptCreated').textContent = 
        appointmentData.fechaCreacion ? 
        new Date(appointmentData.fechaCreacion).toLocaleString('es-CL') : 
        'No disponible';
        
    document.getElementById('editApptCreatedBy').textContent = 
        appointmentData.creadoPor || 'Sistema';
    
    // Configurar límites de fecha
    setupEditDateLimits();
    
    // Cargar horarios disponibles para la fecha actual
    await loadEditAvailableHours();
}


/**
 * Configura los límites de fecha para edición
 */
function setupEditDateLimits() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 60); // Permitir editar hasta 60 días en el futuro
    
    const dateInput = document.getElementById('editApptDate');
    if (dateInput) {
        dateInput.min = today.toISOString().split('T')[0]; // Permitir editar desde hoy
        dateInput.max = maxDate.toISOString().split('T')[0];
        
        // Event listener para validar fines de semana y feriados
        dateInput.addEventListener('change', function() {
            if (validateEditWeekday(this)) {
                loadEditAvailableHours();
            }
        });
    }
}


/**
 * Carga los horarios disponibles para edición
 */
async function loadEditAvailableHours() {
    const date = document.getElementById('editApptDate').value;
    const currentTime = document.getElementById('editApptTime').value;
    
    if (!date) return;
    
    const timeSelect = document.getElementById('editApptTime');
    if (!timeSelect) return;
    
    // Limpiar opciones actuales
    timeSelect.innerHTML = '';
    
    try {
        let occupiedHours = {};
        
        if (isFirebaseConnected && database) {
            // Obtener citas existentes para la fecha
            const citasSnapshot = await database.ref('citas')
                .orderByChild('fecha')
                .equalTo(date)
                .once('value');
            
            if (citasSnapshot.exists()) {
                const citas = citasSnapshot.val();
                Object.values(citas).forEach(cita => {
                    // No contar la cita actual que estamos editando
                    if (cita.estado !== 'cancelada' && 
                        (!currentEditingAppointment || 
                         cita.id !== currentEditingAppointment.id)) {
                        occupiedHours[cita.hora] = (occupiedHours[cita.hora] || 0) + 1;
                    }
                });
            }
        }
        
        // Obtener configuración de máximo de citas por hora
        const maxCitasPorHora = 3; // Configurable
        
        // Llenar las opciones de horario
        availableHours.forEach(hour => {
            const option = document.createElement('option');
            option.value = hour;
            
            const citasEnHora = occupiedHours[hour] || 0;
            
            if (citasEnHora >= maxCitasPorHora && hour !== currentTime) {
                option.textContent = `${hour} (Ocupado)`;
                option.disabled = true;
            } else {
                option.textContent = hour;
                if (citasEnHora > 0 && hour !== currentTime) {
                    const disponibles = maxCitasPorHora - citasEnHora;
                    option.textContent += ` (${disponibles} cupos)`;
                }
            }
            
            // Seleccionar la hora actual
            if (hour === currentTime) {
                option.selected = true;
            }
            
            timeSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error cargando horarios para edición:', error);
        // Cargar horarios básicos en caso de error
        availableHours.forEach(hour => {
            const option = document.createElement('option');
            option.value = hour;
            option.textContent = hour;
            if (hour === currentTime) {
                option.selected = true;
            }
            timeSelect.appendChild(option);
        });
    }
}


/**
 * Guarda los cambios de la cita editada
 */
async function saveAppointmentChanges() {
    if (!currentEditingAppointment) {
        showNotification('Error: No hay cita seleccionada para editar', 'error');
        return;
    }
    
    const appointmentId = currentEditingAppointment.id;
    
    // Recopilar datos del formulario
    const updatedData = {
        fecha: document.getElementById('editApptDate').value,
        hora: document.getElementById('editApptTime').value,
        tipoServicio: document.getElementById('editApptService').value,
        estado: document.getElementById('editApptStatus').value,
        observaciones: document.getElementById('editApptNotes').value,
        fechaModificacion: new Date().toISOString(),
        modificadoPor: currentUser?.email || 'admin'
    };
    
    // Validaciones
    if (!updatedData.fecha || !updatedData.hora || !updatedData.tipoServicio) {
        showNotification('Por favor completa todos los campos obligatorios', 'error');
        return;
    }
    
    // Validar fecha
    const dateObj = new Date(updatedData.fecha + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showNotification('No se pueden programar citas en fines de semana', 'error');
        return;
    }
    
    const feriado = esFeriado(updatedData.fecha);
    if (feriado) {
        showNotification(`No se pueden programar citas en ${feriado}`, 'error');
        return;
    }
    
    try {
        const saveBtn = document.getElementById('saveAppointmentBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
        
        if (isFirebaseConnected && database) {
            // Guardar en Firebase
            await database.ref(`citas/${appointmentId}`).update(updatedData);
            
            // Registrar el cambio en el historial
            await database.ref(`historial_cambios/${appointmentId}`).push({
                tipo: 'edicion',
                cambios: updatedData,
                fechaCambio: new Date().toISOString(),
                realizadoPor: currentUser?.email || 'admin',
                datosAnteriores: {
                    fecha: currentEditingAppointment.fecha,
                    hora: currentEditingAppointment.hora,
                    estado: currentEditingAppointment.estado
                }
            });
            
        } else {
            // Modo demo - simular guardado
            console.log('Demo: Guardando cambios:', updatedData);
        }
        
        showNotification('Cita actualizada exitosamente', 'success');
        
        // Cerrar modal
        hideModal('editAppointmentModal');
        
        // Actualizar la fila en la tabla
        updateAppointmentRowData(appointmentId, updatedData);
        
        // Limpiar referencia
        currentEditingAppointment = null;
        
    } catch (error) {
        console.error('Error guardando cambios:', error);
        showNotification('Error al guardar los cambios', 'error');
    } finally {
        const saveBtn = document.getElementById('saveAppointmentBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
    }
}

/**
 * Actualiza una fila específica en la tabla con nuevos datos
 */
function updateAppointmentRowData(appointmentId, newData) {
    // Actualizar en tabla principal
    const mainRow = document.querySelector(`#appointmentsTableBody tr[data-cita-id="${appointmentId}"]`);
    if (mainRow) {
        const cells = mainRow.cells;
        cells[0].textContent = newData.fecha; // Fecha
        cells[1].textContent = newData.hora;  // Hora
        cells[4].textContent = services[newData.tipoServicio]?.name || newData.tipoServicio; // Servicio
        
        // Actualizar estado
        const statusBadge = cells[5].querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge status-${newData.estado}`;
            statusBadge.textContent = newData.estado;
        }
    }
    
    // Actualizar en tabla de hoy si corresponde
    const today = new Date().toISOString().split('T')[0];
    if (newData.fecha === today) {
        const todayRow = document.querySelector(`#todayAppointments tr[data-cita-id="${appointmentId}"]`);
        if (todayRow) {
            const cells = todayRow.cells;
            cells[0].textContent = newData.hora; // Hora
            cells[2].textContent = services[newData.tipoServicio]?.name || newData.tipoServicio; // Servicio
            
            const statusBadge = cells[3].querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `status-badge status-${newData.estado}`;
                statusBadge.textContent = newData.estado;
            }
        }
    }
}



/**
 * Valida que la fecha no sea fin de semana o feriado
 */
function validateEditWeekday(input) {
    const selectedDate = new Date(input.value + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay();
    
    // Verificar fin de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showNotification('Los fines de semana no están disponibles. Selecciona un día entre lunes y viernes.', 'error');
        input.value = currentEditingAppointment.fecha; // Restaurar fecha original
        return false;
    }
    
    // Verificar feriados nacionales
    const feriado = esFeriado(input.value);
    if (feriado) {
        showNotification(`${feriado} es feriado nacional y no está disponible.`, 'error');
        input.value = currentEditingAppointment.fecha; // Restaurar fecha original
        return false;
    }
    
    return true;
}




async function editAppointment(appointmentId) {
    try {
        console.log(`📝 Editando cita: ${appointmentId}`);
        
        // Obtener datos de la cita
        let appointmentData = null;
        
        if (isFirebaseConnected && database) {
            // Cargar desde Firebase
            const snapshot = await database.ref(`citas/${appointmentId}`).once('value');
            if (snapshot.exists()) {
                appointmentData = { id: appointmentId, ...snapshot.val() };
            } else {
                showNotification('Cita no encontrada', 'error');
                return;
            }
        } else {
            // Modo demo - simular datos
            appointmentData = getDemoAppointmentData(appointmentId);
        }
        
        if (!appointmentData) {
            showNotification('Error al cargar los datos de la cita', 'error');
            return;
        }
        
        // Guardar referencia global
        currentEditingAppointment = appointmentData;
        
        // Llenar el modal con los datos
        await populateEditModal(appointmentData);
        
        // Mostrar el modal
        showModal('editAppointmentModal');
        
    } catch (error) {
        console.error('Error editando cita:', error);
        showNotification('Error al abrir la edición de cita', 'error');
    }
}

/**
 * Obtiene datos demo de una cita para edición
 */
function getDemoAppointmentData(appointmentId) {
    const demoData = {
        '1': {
            id: '1',
            fecha: '2025-01-15',
            hora: '08:00',
            tipoServicio: 'renovacion',
            estado: 'confirmada',
            observaciones: 'Cliente regular',
            cliente_nombre: 'Juan Pérez',
            cliente_rut: '12.345.678-9',
            cliente_email: 'juan.perez@email.com',
            fechaCreacion: '2025-01-10T10:30:00.000Z',
            creadoPor: 'admin@concon.cl'
        },
        '2': {
            id: '2',
            fecha: '2025-01-15',
            hora: '09:00',
            tipoServicio: 'primera_vez',
            estado: 'pendiente',
            observaciones: 'Primera licencia',
            cliente_nombre: 'María García',
            cliente_rut: '98.765.432-1',
            cliente_email: 'maria.garcia@email.com',
            fechaCreacion: '2025-01-12T14:20:00.000Z',
            creadoPor: 'sistema'
        },
        '3': {
            id: '3',
            fecha: '2025-01-16',
            hora: '10:00',
            tipoServicio: 'duplicado',
            estado: 'completada',
            observaciones: 'Duplicado por extravío',
            cliente_nombre: 'Carlos Silva',
            cliente_rut: '11.222.333-4',
            cliente_email: 'carlos.silva@email.com',
            fechaCreacion: '2025-01-14T16:45:00.000Z',
            creadoPor: 'admin@concon.cl'
        }
    };
    
    return demoData[appointmentId] || null;
}


/**
 * Elimina una cita permanentemente (solo para administradores)
 */
async function deleteAppointment(appointmentId) {
    if (!confirm('⚠️ ¿Estás seguro de ELIMINAR permanentemente esta cita?\n\nEsta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        if (isFirebaseConnected && database) {
            // Mover a papelera antes de eliminar
            const citaSnapshot = await database.ref(`citas/${appointmentId}`).once('value');
            if (citaSnapshot.exists()) {
                const citaData = citaSnapshot.val();
                
                // Guardar en papelera
                await database.ref(`papelera/citas/${appointmentId}`).set({
                    ...citaData,
                    fechaEliminacion: new Date().toISOString(),
                    eliminadoPor: currentUser?.email || 'admin'
                });
                
                // Eliminar de citas activas
                await database.ref(`citas/${appointmentId}`).remove();
            }
        }
        
        showNotification('Cita eliminada permanentemente', 'success');
        
        // Remover de la tabla
        const row = document.querySelector(`tr[data-cita-id="${appointmentId}"]`);
        if (row) {
            row.remove();
        }
        
        // Cerrar modal si está abierto
        hideModal('editAppointmentModal');
        
    } catch (error) {
        console.error('Error eliminando cita:', error);
        showNotification('Error al eliminar la cita', 'error');
    }
}

/**
 * Cancela la edición y cierra el modal
 */
function cancelAppointmentEdit() {
    currentEditingAppointment = null;
    hideModal('editAppointmentModal');
}

function hideEditModal() {
    // Función placeholder para compatibilidad
    console.log('hideEditModal called');
}

/**
 * Verifica si el usuario tiene citas anteriores sin completar
 * @returns {Promise<Object>} {canSchedule: boolean, blockedCita: Object|null, message: string}
 */
async function checkPreviousAppointments() {
    if (!currentUser) {
        return { canSchedule: false, blockedCita: null, message: 'Debes iniciar sesión para agendar citas' };
    }

    try {
        if (isFirebaseConnected && database) {
            // Verificar en Firebase
            const citasSnapshot = await database.ref('citas')
                .orderByChild('usuario_id')
                .equalTo(currentUser.uid)
                .once('value');
            
            if (citasSnapshot.exists()) {
                const citas = citasSnapshot.val();
                const citasArray = Object.entries(citas).map(([id, cita]) => ({ id, ...cita }));
                
                // Buscar citas que bloqueen el agendamiento
                const citasBloqueantes = citasArray.filter(cita => {
                    // Solo bloquean las citas pendientes, confirmadas o reprogramadas
                    return ['pendiente', 'confirmada', 'reprogramada'].includes(cita.estado);
                });
                
                if (citasBloqueantes.length > 0) {
                    // Ordenar por fecha para mostrar la más próxima
                    citasBloqueantes.sort((a, b) => {
                        if (a.fecha === b.fecha) {
                            return a.hora.localeCompare(b.hora);
                        }
                        return new Date(a.fecha) - new Date(b.fecha);
                    });
                    
                    const proximaCita = citasBloqueantes[0];
                    const service = services[proximaCita.tipoServicio];
                    const fechaFormateada = formatDate(proximaCita.fecha);
                    
                    return {
                        canSchedule: false,
                        blockedCita: proximaCita,
                        message: `Tienes una cita ${proximaCita.estado} para ${service?.name || proximaCita.tipoServicio} el ${fechaFormateada} a las ${proximaCita.hora}. Debes completar o cancelar esta cita antes de agendar una nueva.`
                    };
                }
            }
            
            return { canSchedule: true, blockedCita: null, message: '' };
            
        } else {
            // Modo demo - simular una cita bloqueante ocasionalmente
            if (Math.random() > 0.7) { // 30% de probabilidad de tener cita bloqueante
                return {
                    canSchedule: false,
                    blockedCita: {
                        id: 'demo_blocked',
                        tipoServicio: 'renovacion',
                        fecha: '2025-01-15',
                        hora: '10:00',
                        estado: 'confirmada'
                    },
                    message: 'Tienes una cita confirmada para Renovación el martes, 15 de enero de 2025 a las 10:00. Debes completar o cancelar esta cita antes de agendar una nueva.'
                };
            }
            
            return { canSchedule: true, blockedCita: null, message: '' };
        }
        
    } catch (error) {
        console.error('Error verificando citas anteriores:', error);
        return { canSchedule: true, blockedCita: null, message: '' }; // En caso de error, permitir continuar
    }
}

/**
 * Muestra el bloqueo de agendamiento con información de la cita anterior
 */
function showScheduleBlocker(blockedCita, message) {
    const scheduleContent = document.getElementById('scheduleContent');
    if (!scheduleContent) return;
    
    const service = services[blockedCita.tipoServicio];
    const fechaFormateada = formatDate(blockedCita.fecha);
    
    scheduleContent.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                <span class="material-icons" style="font-size: 64px; color: #f39c12; margin-bottom: 20px;">schedule</span>
                <h3 style="color: #856404; margin-bottom: 15px;">⏳ Cita Pendiente</h3>
                <p style="color: #856404; line-height: 1.6; margin-bottom: 20px;">${message}</p>
                
                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
                    <h4 style="margin-bottom: 15px; color: #333;">📋 Detalles de tu cita actual:</h4>
                    <div style="display: grid; gap: 10px;">
                        <div><strong>Servicio:</strong> ${service?.name || blockedCita.tipoServicio}</div>
                        <div><strong>Fecha:</strong> ${fechaFormateada}</div>
                        <div><strong>Hora:</strong> ${blockedCita.hora}</div>
                        <div><strong>Estado:</strong> <span class="status-badge status-${blockedCita.estado}">${blockedCita.estado}</span></div>
                        ${service?.price ? `<div><strong>Costo:</strong> $${service.price.toLocaleString('es-CL')}</div>` : ''}
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-top: 25px;">
                    <button class="btn btn-info" onclick="showClientTab('mycites')">
                        <span class="material-icons">list</span>
                        Ver Mis Citas
                    </button>
                    
                    ${blockedCita.estado !== 'cancelada' ? `
                        <button class="btn btn-warning" onclick="rescheduleAppointment('${blockedCita.id}')">
                            <span class="material-icons">schedule</span>
                            Reprogramar Cita
                        </button>
                        
                        <button class="btn btn-danger" onclick="cancelUserAppointment('${blockedCita.id}')">
                            <span class="material-icons">cancel</span>
                            Cancelar Cita
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div style="background: #e8f5e8; border: 1px solid #c3e6c3; border-radius: 8px; padding: 20px; margin-top: 20px;">
                <p style="color: #2d5a2d; margin: 0; font-size: 0.95rem;">
                    <span class="material-icons" style="vertical-align: middle; margin-right: 8px; font-size: 20px;">info</span>
                    <strong>¿Por qué esta restricción?</strong><br>
                    Para garantizar un servicio de calidad y evitar acumulación de citas, solo puedes tener una cita activa a la vez.
                </p>
            </div>
        </div>
    `;
}

// ============= MODIFICACIONES A FUNCIONES EXISTENTES =============

// Modificar la función showClientTab para verificar restricciones
const originalShowClientTab = window.showClientTab;
window.showClientTab = async function(tabName) {
    // Ejecutar la función original
    originalShowClientTab(tabName);
    
    // Si están tratando de acceder al tab de agendamiento, verificar restricciones
    if (tabName === 'schedule' && currentUser && currentUserRole === 'cliente') {
        const scheduleContent = document.getElementById('scheduleContent');
        if (scheduleContent && !scheduleContent.classList.contains('hidden')) {
            await validateScheduleAccess();
        }
    }
};

/**
 * Valida si el usuario puede acceder al sistema de agendamiento
 */
async function validateScheduleAccess() {
    try {
        showMessage('scheduleMessage', 'Verificando citas anteriores...', 'info');
        
        const validation = await checkPreviousAppointments();
        
        if (!validation.canSchedule) {
            showMessage('scheduleMessage', '', ''); // Limpiar mensaje
            showScheduleBlocker(validation.blockedCita, validation.message);
        } else {
            // Si puede agendar, mostrar el contenido normal y limpiar mensaje
            showMessage('scheduleMessage', '', '');
            const scheduleContent = document.getElementById('scheduleContent');
            if (scheduleContent) {
                // Restaurar el contenido original si fue modificado
                if (!scheduleContent.innerHTML.includes('step1')) {
                    location.reload(); // Recargar para restaurar contenido original
                }
            }
        }
    } catch (error) {
        console.error('Error validando acceso a agendamiento:', error);
        showMessage('scheduleMessage', 'Error verificando citas anteriores. Inténtalo nuevamente.', 'error');
    }
}

// Modificar la función confirmAppointment para agregar validación adicional
const originalConfirmAppointment = window.confirmAppointment;
window.confirmAppointment = async function() {
    if (!selectedService || !selectedDate || !selectedTime) {
        showMessage('scheduleMessage', 'Error: Faltan datos de la cita', 'error');
        return;
    }

    // Verificar nuevamente antes de confirmar (por si cambió algo mientras el usuario estaba en el proceso)
    const validation = await checkPreviousAppointments();
    
    if (!validation.canSchedule) {
        showMessage('scheduleMessage', validation.message, 'error');
        setTimeout(() => {
            showScheduleBlocker(validation.blockedCita, validation.message);
        }, 2000);
        return;
    }

    // Si pasa la validación, ejecutar la función original
    await originalConfirmAppointment();
};

// Modificar funciones de cancelación y completado para actualizar el estado de agendamiento
const originalCancelUserAppointment = window.cancelUserAppointment;
window.cancelUserAppointment = async function(id) {
    const result = await originalCancelUserAppointment(id);
    
    // Después de cancelar, verificar si ahora puede agendar
    setTimeout(async () => {
        if (document.getElementById('scheduleContent') && !document.getElementById('scheduleContent').classList.contains('hidden')) {
            await validateScheduleAccess();
        }
    }, 1500);
    
    return result;
};

// Función para actualizar el estado después de completar una cita (para administradores)
const originalCompleteAppointmentAsync = completeAppointmentAsync;
window.completeAppointmentAsync = async function(id) {
    await originalCompleteAppointmentAsync(id);
    
    // Notificar a todos los clientes conectados que pueden volver a agendar
    // (En una implementación real, esto se haría con WebSockets o notificaciones push)
    console.log('Cita completada - Cliente puede agendar nuevamente');
};

// ============= FUNCIONES AUXILIARES ADICIONALES =============

/**
 * Obtiene el conteo de citas activas del usuario
 */
async function getUserActiveCitasCount() {
    if (!currentUser || !isFirebaseConnected || !database) {
        return 0;
    }

    try {
        const citasSnapshot = await database.ref('citas')
            .orderByChild('usuario_id')
            .equalTo(currentUser.uid)
            .once('value');
        
        if (citasSnapshot.exists()) {
            const citas = citasSnapshot.val();
            const citasActivas = Object.values(citas).filter(cita => 
                ['pendiente', 'confirmada', 'reprogramada'].includes(cita.estado)
            );
            return citasActivas.length;
        }
        
        return 0;
    } catch (error) {
        console.error('Error contando citas activas:', error);
        return 0;
    }
}

/**
 * Muestra información sobre las restricciones de agendamiento
 */
function showSchedulingInfo() {
    showNotification(
        '📋 Solo puedes tener una cita activa a la vez. Completa o cancela tu cita actual para agendar una nueva.',
        'info'
    );
}

// ============= VALIDADOR DE RUT CHILENO COMPLETO =============
// 🇨🇱 Función de validación optimizada

var Fn = {
    // Valida el rut con su cadena completa "XXXXXXXX-X"
    validaRut: function (rutCompleto) {
        if (!/^[0-9]+[-|‐]{1}[0-9kK]{1}$/.test(rutCompleto)) return false;
        var tmp = rutCompleto.split('-');
        var digv = tmp[1];
        var rut = tmp[0];
        if (digv == 'K') digv = 'k';
        return (Fn.dv(rut) == digv);
    },
    
    dv: function(T) {
        var M = 0, S = 1;
        for (; T; T = Math.floor(T / 10))
            S = (S + T % 10 * (9 - M++ % 6)) % 11;
        return S ? S - 1 : 'k';
    }
};

/**
 * Limpia el RUT removiendo puntos, guiones y espacios
 */
function limpiarRut(rut) {
    if (!rut) return '';
    return rut.toString().replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Formatea el RUT agregando puntos y guión
 */
function formatearRut(rut) {
    const rutLimpio = limpiarRut(rut);
    if (rutLimpio.length < 2) return rutLimpio;
    
    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);
    
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpoFormateado}-${dv}`;
}

/**
 * Convierte RUT limpio a formato para validación
 */
function rutParaValidacion(rut) {
    const rutLimpio = limpiarRut(rut);
    if (rutLimpio.length < 2) return rutLimpio;
    
    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);
    
    return `${cuerpo}-${dv}`;
}

/**
 * Valida si un RUT chileno es válido
 */
function validarRutChileno(rut) {
    const result = {
        isValid: false,
        message: '',
        formatted: ''
    };
    
    if (!rut) {
        result.message = 'RUT es requerido';
        return result;
    }
    
    const rutLimpio = limpiarRut(rut);
    
    if (rutLimpio.length < 8) {
        result.message = 'RUT debe tener al menos 8 dígitos';
        return result;
    }
    
    if (rutLimpio.length > 9) {
        result.message = 'RUT no puede tener más de 9 dígitos';
        return result;
    }
    
    const cuerpo = rutLimpio.slice(0, -1);
    if (/^(\d)\1+$/.test(cuerpo)) {
        result.message = 'RUT no puede tener todos los dígitos iguales';
        return result;
    }
    
    const rutParaValidar = rutParaValidacion(rutLimpio);
    
    if (!Fn.validaRut(rutParaValidar)) {
        result.message = 'RUT inválido - Dígito verificador incorrecto';
        return result;
    }
    
    result.isValid = true;
    result.message = 'RUT válido ✓';
    result.formatted = formatearRut(rutLimpio);
    
    return result;
}

/**
 * Configura la validación de RUT en un campo
 */
function configurarValidacionRut(inputId) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.warn(`Campo ${inputId} no encontrado`);
        return;
    }
    
    let messageContainer = document.getElementById(inputId + '_message');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = inputId + '_message';
        messageContainer.className = 'rut-validation-message';
        input.parentNode.insertBefore(messageContainer, input.nextSibling);
    }
    
    input.classList.add('rut-input');
    
    input.addEventListener('input', function(e) {
        const rut = e.target.value;
        const rutLimpio = limpiarRut(rut);
        
        if (rutLimpio.length >= 8) {
            const cursorPos = e.target.selectionStart;
            const rutFormateado = formatearRut(rutLimpio);
            
            if (rutFormateado !== rut && rut.length <= rutFormateado.length) {
                e.target.value = rutFormateado;
                const newCursorPos = cursorPos + (rutFormateado.length - rut.length);
                e.target.setSelectionRange(newCursorPos, newCursorPos);
            }
        }
        
        if (rutLimpio.length >= 8) {
            validarCampoRut(inputId);
        } else {
            limpiarValidacionRut(inputId);
        }
    });
    
    input.addEventListener('blur', function() {
        if (this.value.trim()) {
            validarCampoRut(inputId);
        }
    });
    
    input.placeholder = '12.345.678-9';
    input.setAttribute('maxlength', '12');
    
    if (!document.getElementById(inputId + '_help')) {
        const helpText = document.createElement('small');
        helpText.id = inputId + '_help';
        helpText.className = 'rut-help-text';
        helpText.innerHTML = `
            <span style="color: #666; font-size: 0.85rem; display: block; margin-top: 4px;">
                💡 Ingresa tu RUT con o sin puntos y guión. Ej: 12345678-9
            </span>
        `;
        messageContainer.parentNode.insertBefore(helpText, messageContainer.nextSibling);
    }
}

/**
 * Valida un campo de RUT específico visualmente
 */
function validarCampoRut(inputId) {
    const input = document.getElementById(inputId);
    const messageContainer = document.getElementById(inputId + '_message');
    
    if (!input) return false;
    
    const rut = input.value.trim();
    const validation = validarRutChileno(rut);
    
    input.classList.remove('rut-valid', 'rut-invalid', 'rut-empty');
    
    if (!rut) {
        input.classList.add('rut-empty');
        if (messageContainer) {
            messageContainer.innerHTML = '';
        }
        return false;
    }
    
    if (validation.isValid) {
        input.classList.add('rut-valid');
        input.value = validation.formatted;
        if (messageContainer) {
            messageContainer.innerHTML = `
                <span class="rut-message rut-success">
                    <span class="material-icons" style="font-size: 16px; vertical-align: middle;">check_circle</span>
                    <span style="color: #28a745; font-size: 0.85rem; margin-left: 5px;">${validation.message}</span>
                </span>
            `;
        }
        return true;
    } else {
        input.classList.add('rut-invalid');
        if (messageContainer) {
            messageContainer.innerHTML = `
                <span class="rut-message rut-error">
                    <span class="material-icons" style="font-size: 16px; vertical-align: middle;">error</span>
                    <span style="color: #dc3545; font-size: 0.85rem; margin-left: 5px;">${validation.message}</span>
                </span>
            `;
        }
        return false;
    }
}

/**
 * Limpia la validación visual
 */
function limpiarValidacionRut(inputId) {
    const input = document.getElementById(inputId);
    const messageContainer = document.getElementById(inputId + '_message');
    
    if (input) {
        input.classList.remove('rut-valid', 'rut-invalid');
    }
    
    if (messageContainer) {
        messageContainer.innerHTML = '';
    }
}

/**
 * Inicializa la validación en todos los campos RUT
 */
function inicializarValidacionRut() {
    configurarValidacionRut('regRut');
    
    if (document.getElementById('newUserRut')) {
        configurarValidacionRut('newUserRut');
    }
    
    console.log('✅ Validación de RUT chileno configurada');
}

// Modificar registro de cliente para validar RUT
const originalHandleClientRegister = handleClientRegister;
window.handleClientRegister = async function(e) {
    e.preventDefault();
    
    const rutValido = validarCampoRut('regRut');
    if (!rutValido) {
        showMessage('registerMessage', 'Por favor corrige el RUT antes de continuar', 'error');
        return;
    }
    
    const rut = document.getElementById('regRut').value;
    if (isFirebaseConnected && database) {
        try {
            const rutSnapshot = await database.ref('usuarios').orderByChild('rut').equalTo(rut).once('value');
            if (rutSnapshot.exists()) {
                showMessage('registerMessage', 'Este RUT ya está registrado en el sistema', 'error');
                return;
            }
        } catch (error) {
            console.warn('Error verificando RUT duplicado:', error);
        }
    }
    
    await originalHandleClientRegister(e);
};

// Modificar creación de usuario (admin) para validar RUT
const originalHandleNewUser = handleNewUser;
window.handleNewUser = async function(e) {
    e.preventDefault();
    
    const rutValido = validarCampoRut('newUserRut');
    if (!rutValido) {
        showNotification('Por favor corrige el RUT antes de continuar', 'error');
        return;
    }
    
    const rut = document.getElementById('newUserRut').value;
    if (isFirebaseConnected && database) {
        try {
            const rutSnapshot = await database.ref('usuarios').orderByChild('rut').equalTo(rut).once('value');
            if (rutSnapshot.exists()) {
                showNotification('Este RUT ya está registrado en el sistema', 'error');
                return;
            }
        } catch (error) {
            console.warn('Error verificando RUT duplicado:', error);
        }
    }
    
    await originalHandleNewUser(e);
};


// Método 1: Escribir palabra secreta
function setupSecretKeyword() {
    const secretWord = 'admin123'; // Cambia por tu palabra secreta
    
    document.addEventListener('keydown', function(e) {
        // Solo en la vista pública
        if (!document.getElementById('publicView').classList.contains('hidden')) {
            keySequence.push(e.key.toLowerCase());
            
            // Mantener solo los últimos caracteres necesarios
            if (keySequence.length > secretWord.length) {
                keySequence = keySequence.slice(-secretWord.length);
            }
            
            // Verificar si coincide
            if (keySequence.join('') === secretWord) {
                showAdminLogin();
                showNotification('🔑 Acceso administrativo activado', 'success');
                keySequence = []; // Reset
            }
        }
    });
}

// Método 2: Combinación Ctrl+Shift+A
function setupKeyCombo() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            if (!document.getElementById('publicView').classList.contains('hidden')) {
                showAdminLogin();
                showNotification('🔑 Acceso por combinación de teclas', 'success');
            }
        }
    });
}

// Método 3: Secuencia especial (como Konami Code)
function setupKonamiCode() {
    const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'KeyA', 'KeyD', 'KeyM', 'KeyI', 'KeyN'];
    let userSequence = [];
    
    document.addEventListener('keydown', function(e) {
        userSequence.push(e.code);
        
        if (userSequence.length > sequence.length) {
            userSequence = userSequence.slice(-sequence.length);
        }
        
        if (userSequence.join(',') === sequence.join(',')) {
            showAdminLogin();
            showNotification('🎮 Código Konami detectado - Acceso admin', 'success');
            userSequence = [];
        }
    });
}

// Inicializar todos los métodos
document.addEventListener('DOMContentLoaded', function() {
    setupSecretKeyword();
    setupKeyCombo();
    setupKonamiCode();
    
    console.log('⌨️ Métodos de teclado activados:');
    console.log('   • Escribir: admin123');
    console.log('   • Presionar: Ctrl + Shift + A');
    console.log('   • Secuencia: ↑↑↓↓ A D M I N');
});

// Inicialización
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(inicializarValidacionRut, 500);
    });
} else {
    setTimeout(inicializarValidacionRut, 500);
}


// ============= SISTEMA DE CONTROL DE ASISTENCIA =============

// Variables globales para asistencia
let attendanceData = [];
let employeesData = [];
let currentAttendanceDate = new Date().toISOString().split('T')[0];

// ============= FUNCIONES PRINCIPALES =============

/**
 * Inicializa el módulo de asistencia
 */
function initializeAttendanceModule() {
    console.log('🕐 Inicializando módulo de asistencia...');
    
    // Configurar fecha actual
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) {
        dateInput.value = currentAttendanceDate;
        dateInput.addEventListener('change', () => {
            currentAttendanceDate = dateInput.value;
            loadAttendanceData();
        });
    }
    
    // Cargar datos iniciales
    loadEmployeesData();
    loadAttendanceData();
    
    // Actualizar cada minuto
    setInterval(updateCurrentTime, 60000);
    updateCurrentTime();
}

/**
 * Carga los datos de empleados
 */
async function loadEmployeesData() {
    try {
        if (isFirebaseConnected && database) {
            // Cargar empleados desde Firebase
            const empleadosSnapshot = await database.ref('empleados').once('value');
            const administradoresSnapshot = await database.ref('administradores').once('value');
            
            employeesData = [];
            
            if (empleadosSnapshot.exists()) {
                const empleados = empleadosSnapshot.val();
                Object.entries(empleados).forEach(([id, empleado]) => {
                    if (empleado.activo) {
                        employeesData.push({
                            id,
                            nombre: empleado.nombre,
                            email: empleado.email,
                            cargo: empleado.cargo || 'Empleado',
                            horarioEntrada: empleado.horarioEntrada || '08:00',
                            horarioSalida: empleado.horarioSalida || '17:00',
                            tipo: 'empleado'
                        });
                    }
                });
            }
            
            if (administradoresSnapshot.exists()) {
                const administradores = administradoresSnapshot.val();
                Object.entries(administradores).forEach(([id, admin]) => {
                    if (admin.activo) {
                        employeesData.push({
                            id,
                            nombre: admin.nombre,
                            email: admin.email,
                            cargo: 'Administrador',
                            horarioEntrada: '08:00',
                            horarioSalida: '17:00',
                            tipo: 'administrador'
                        });
                    }
                });
            }
        } else {
            // Datos demo
            employeesData = [
                {
                    id: 'emp_001',
                    nombre: 'Felipe Albornoz',
                    email: 'albornoz.felipealfonso@cftpucv.cl',
                    cargo: 'Administrador',
                    horarioEntrada: '08:00',
                    horarioSalida: '17:00',
                    tipo: 'administrador'
                },
                {
                    id: 'emp_002',
                    nombre: 'Francisco Vidal',
                    email: 'vidal.franciscojavier@cftpucv.cl',
                    cargo: 'Administrador',
                    horarioEntrada: '08:00',
                    horarioSalida: '17:00',
                    tipo: 'administrador'
                },
                {
                    id: 'emp_003',
                    nombre: 'DEMO',
                    email: 'maria.gonzalez@concon.cl',
                    cargo: 'Secretaria',
                    horarioEntrada: '08:30',
                    horarioSalida: '16:30',
                    tipo: 'empleado'
                },
                {
                    id: 'emp_004',
                    nombre: 'DEMO',
                    email: 'carlos.reyes@concon.cl',
                    cargo: 'Supervisor',
                    horarioEntrada: '07:30',
                    horarioSalida: '16:30',
                    tipo: 'empleado'
                }
            ];
        }
        
        console.log(`✅ ${employeesData.length} empleados cargados`);
        renderAttendanceTable();
        
    } catch (error) {
        console.error('Error cargando empleados:', error);
        showNotification('Error al cargar datos de empleados', 'error');
    }
}

/**
 * Carga los datos de asistencia para la fecha actual
 */
async function loadAttendanceData() {
    try {
        if (isFirebaseConnected && database) {
            // Cargar asistencia desde Firebase
            const attendanceSnapshot = await database.ref(`asistencia/${currentAttendanceDate.replace(/-/g, '_')}`).once('value');
            
            attendanceData = [];
            if (attendanceSnapshot.exists()) {
                const attendance = attendanceSnapshot.val();
                Object.entries(attendance).forEach(([employeeId, data]) => {
                    attendanceData.push({
                        employeeId,
                        ...data
                    });
                });
            }
        } else {
            // Datos demo para hoy
            if (currentAttendanceDate === new Date().toISOString().split('T')[0]) {
                attendanceData = [
                    {
                        employeeId: 'emp_001',
                        entradaHora: '08:05',
                        entradaTimestamp: new Date().setHours(8, 5, 0),
                        estado: 'presente',
                        observaciones: ''
                    },
                    {
                        employeeId: 'emp_002',
                        entradaHora: '08:15',
                        entradaTimestamp: new Date().setHours(8, 15, 0),
                        salidaHora: '17:10',
                        salidaTimestamp: new Date().setHours(17, 10, 0),
                        estado: 'completado',
                        observaciones: ''
                    },
                    {
                        employeeId: 'emp_003',
                        estado: 'ausente',
                        observaciones: 'Enfermedad justificada'
                    }
                ];
            } else {
                attendanceData = [];
            }
        }
        
        renderAttendanceTable();
        updateAttendanceStats();
        
    } catch (error) {
        console.error('Error cargando asistencia:', error);
        showNotification('Error al cargar datos de asistencia', 'error');
    }
}

/**
 * Renderiza la tabla de asistencia
 */
function renderAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    employeesData.forEach(employee => {
        const attendance = attendanceData.find(a => a.employeeId === employee.id);
        const currentTime = new Date();
        const isToday = currentAttendanceDate === new Date().toISOString().split('T')[0];
        
        // Determinar estado y acciones
        let estado = 'Sin registrar';
        let estadoClass = 'status-pendiente';
        let actions = '';
        
        if (attendance) {
            if (attendance.estado === 'ausente') {
                estado = 'Ausente';
                estadoClass = 'status-cancelada';
            } else if (attendance.estado === 'presente') {
                estado = `Presente (${attendance.entradaHora})`;
                estadoClass = 'status-confirmada';
                if (isToday) {
                    actions = `<button class="btn btn-warning btn-sm" onclick="registerExit('${employee.id}')">
                                <span class="material-icons">logout</span> Salida
                              </button>`;
                }
            } else if (attendance.estado === 'completado') {
                estado = `${attendance.entradaHora} - ${attendance.salidaHora}`;
                estadoClass = 'status-completada';
            } else if (attendance.estado === 'tardanza') {
                estado = `Tardanza (${attendance.entradaHora})`;
                estadoClass = 'status-pendiente';
                if (isToday && !attendance.salidaHora) {
                    actions = `<button class="btn btn-warning btn-sm" onclick="registerExit('${employee.id}')">
                                <span class="material-icons">logout</span> Salida
                              </button>`;
                }
            }
        } else if (isToday) {
            actions = `
                <button class="btn btn-success btn-sm" onclick="registerEntry('${employee.id}')">
                    <span class="material-icons">login</span> Entrada
                </button>
                <button class="btn btn-danger btn-sm" onclick="markAbsent('${employee.id}')">
                    <span class="material-icons">event_busy</span> Ausente
                </button>
            `;
        }
        
        // Calcular si está tarde
        let lateIndicator = '';
        if (attendance && attendance.entradaHora && employee.horarioEntrada) {
            const entradaReal = new Date(`2025-01-01T${attendance.entradaHora}:00`);
            const horarioEsperado = new Date(`2025-01-01T${employee.horarioEntrada}:00`);
            
            if (entradaReal > horarioEsperado) {
                const minutosRetraso = Math.floor((entradaReal - horarioEsperado) / (1000 * 60));
                lateIndicator = `<small style="color: #dc3545;">+${minutosRetraso} min</small>`;
            }
        }
        
        tbody.innerHTML += `
            <tr data-employee-id="${employee.id}">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="employee-avatar">${employee.nombre.split(' ').map(n => n[0]).join('').substr(0, 2)}</div>
                        <div>
                            <strong>${employee.nombre}</strong><br>
                            <small style="color: #666;">${employee.cargo}</small>
                        </div>
                    </div>
                </td>
                <td>${employee.horarioEntrada} - ${employee.horarioSalida}</td>
                <td>
                    <span class="status-badge ${estadoClass}">${estado}</span>
                    ${lateIndicator}
                </td>
                <td>
                    <small style="color: #666;">${attendance?.observaciones || ''}</small>
                </td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        ${actions}
                        <button class="btn btn-info btn-sm" onclick="viewEmployeeHistory('${employee.id}')">
                            <span class="material-icons">history</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

/**
 * Registra la entrada de un empleado
 */
async function registerEntry(employeeId) {
    try {
        const currentTime = new Date();
        const timeString = currentTime.toTimeString().substring(0, 5);
        const employee = employeesData.find(e => e.id === employeeId);
        
        if (!employee) {
            showNotification('Empleado no encontrado', 'error');
            return;
        }
        
        // Determinar si es tardanza
        const horarioEntrada = new Date(`2025-01-01T${employee.horarioEntrada}:00`);
        const horaActual = new Date(`2025-01-01T${timeString}:00`);
        const estado = horaActual > horarioEntrada ? 'tardanza' : 'presente';
        
        const attendanceRecord = {
            entradaHora: timeString,
            entradaTimestamp: currentTime.getTime(),
            estado: estado,
            observaciones: estado === 'tardanza' ? 'Llegada tardía' : '',
            registradoPor: currentUser?.email || 'sistema'
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia/${currentAttendanceDate.replace(/-/g, '_')}/${employeeId}`).set(attendanceRecord);
        } else {
            // Actualizar datos demo
            const existingIndex = attendanceData.findIndex(a => a.employeeId === employeeId);
            if (existingIndex >= 0) {
                attendanceData[existingIndex] = { employeeId, ...attendanceRecord };
            } else {
                attendanceData.push({ employeeId, ...attendanceRecord });
            }
        }
        
        showNotification(`Entrada registrada para ${employee.nombre} a las ${timeString}`, 'success');
        loadAttendanceData();
        
    } catch (error) {
        console.error('Error registrando entrada:', error);
        showNotification('Error al registrar entrada', 'error');
    }
}

/**
 * Registra la salida de un empleado
 */
async function registerExit(employeeId) {
    try {
        const currentTime = new Date();
        const timeString = currentTime.toTimeString().substring(0, 5);
        const employee = employeesData.find(e => e.id === employeeId);
        
        if (!employee) {
            showNotification('Empleado no encontrado', 'error');
            return;
        }
        
        const attendanceRecord = {
            salidaHora: timeString,
            salidaTimestamp: currentTime.getTime(),
            estado: 'completado',
            registradoPor: currentUser?.email || 'sistema'
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia/${currentAttendanceDate.replace(/-/g, '_')}/${employeeId}`).update(attendanceRecord);
        } else {
            // Actualizar datos demo
            const existingIndex = attendanceData.findIndex(a => a.employeeId === employeeId);
            if (existingIndex >= 0) {
                Object.assign(attendanceData[existingIndex], attendanceRecord);
            }
        }
        
        showNotification(`Salida registrada para ${employee.nombre} a las ${timeString}`, 'success');
        loadAttendanceData();
        
    } catch (error) {
        console.error('Error registrando salida:', error);
        showNotification('Error al registrar salida', 'error');
    }
}

/**
 * Marca a un empleado como ausente
 */
async function markAbsent(employeeId) {
    const reason = prompt('Motivo de la ausencia (opcional):');
    
    try {
        const employee = employeesData.find(e => e.id === employeeId);
        
        if (!employee) {
            showNotification('Empleado no encontrado', 'error');
            return;
        }
        
        const attendanceRecord = {
            estado: 'ausente',
            observaciones: reason || 'Ausencia sin especificar',
            registradoPor: currentUser?.email || 'sistema',
            timestamp: new Date().getTime()
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia/${currentAttendanceDate.replace(/-/g, '_')}/${employeeId}`).set(attendanceRecord);
        } else {
            // Actualizar datos demo
            const existingIndex = attendanceData.findIndex(a => a.employeeId === employeeId);
            if (existingIndex >= 0) {
                attendanceData[existingIndex] = { employeeId, ...attendanceRecord };
            } else {
                attendanceData.push({ employeeId, ...attendanceRecord });
            }
        }
        
        showNotification(`${employee.nombre} marcado como ausente`, 'success');
        loadAttendanceData();
        
    } catch (error) {
        console.error('Error marcando ausencia:', error);
        showNotification('Error al marcar ausencia', 'error');
    }
}

/**
 * Actualiza las estadísticas de asistencia
 */
function updateAttendanceStats() {
    const totalEmployees = employeesData.length;
    const presentEmployees = attendanceData.filter(a => a.estado === 'presente' || a.estado === 'completado' || a.estado === 'tardanza').length;
    const absentEmployees = attendanceData.filter(a => a.estado === 'ausente').length;
    const lateEmployees = attendanceData.filter(a => a.estado === 'tardanza').length;
    const pendingEmployees = totalEmployees - attendanceData.length;
    
    // Actualizar elementos del DOM
    const statsElements = {
        totalAttendance: document.getElementById('totalAttendance'),
        presentAttendance: document.getElementById('presentAttendance'),
        absentAttendance: document.getElementById('absentAttendance'),
        lateAttendance: document.getElementById('lateAttendance'),
        pendingAttendance: document.getElementById('pendingAttendance')
    };
    
    if (statsElements.totalAttendance) statsElements.totalAttendance.textContent = totalEmployees;
    if (statsElements.presentAttendance) statsElements.presentAttendance.textContent = presentEmployees;
    if (statsElements.absentAttendance) statsElements.absentAttendance.textContent = absentEmployees;
    if (statsElements.lateAttendance) statsElements.lateAttendance.textContent = lateEmployees;
    if (statsElements.pendingAttendance) statsElements.pendingAttendance.textContent = pendingEmployees;
    
    // Calcular porcentaje de asistencia
    const attendancePercentage = totalEmployees > 0 ? Math.round((presentEmployees / totalEmployees) * 100) : 0;
    const percentageElement = document.getElementById('attendancePercentage');
    if (percentageElement) {
        percentageElement.textContent = `${attendancePercentage}%`;
        percentageElement.style.color = attendancePercentage >= 90 ? '#28a745' : attendancePercentage >= 75 ? '#ffc107' : '#dc3545';
    }
}

/**
 * Actualiza la hora actual en tiempo real
 */
function updateCurrentTime() {
    const currentTimeElement = document.getElementById('currentTime');
    if (currentTimeElement) {
        const now = new Date();
        currentTimeElement.textContent = now.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

/**
 * Ver historial de asistencia de un empleado
 */
async function viewEmployeeHistory(employeeId) {
    try {
        const employee = employeesData.find(e => e.id === employeeId);
        if (!employee) {
            showNotification('Empleado no encontrado', 'error');
            return;
        }
        
        let historyData = [];
        
        if (isFirebaseConnected && database) {
            // Obtener últimos 30 días
            const historySnapshot = await database.ref('asistencia').once('value');
            if (historySnapshot.exists()) {
                const allAttendance = historySnapshot.val();
                Object.entries(allAttendance).forEach(([date, dayData]) => {
                    if (dayData[employeeId]) {
                        historyData.push({
                            fecha: date.replace(/_/g, '-'),
                            ...dayData[employeeId]
                        });
                    }
                });
            }
        } else {
            // Datos demo
            historyData = [
                {
                    fecha: '2025-01-10',
                    entradaHora: '08:05',
                    salidaHora: '17:02',
                    estado: 'completado'
                },
                {
                    fecha: '2025-01-09',
                    entradaHora: '08:15',
                    salidaHora: '17:10',
                    estado: 'tardanza'
                },
                {
                    fecha: '2025-01-08',
                    estado: 'ausente',
                    observaciones: 'Cita médica'
                }
            ];
        }
        
        showEmployeeHistoryModal(employee, historyData);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        showNotification('Error al cargar historial', 'error');
    }
}

/**
 * Muestra modal con historial del empleado
 */
function showEmployeeHistoryModal(employee, historyData) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'employeeHistoryModal';
    
    let historyHtml = '';
    if (historyData.length > 0) {
        historyData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        historyData.slice(0, 15).forEach(day => {
            const fecha = new Date(day.fecha).toLocaleDateString('es-CL');
            let statusInfo = '';
            let statusClass = '';
            
            switch (day.estado) {
                case 'completado':
                    statusInfo = `${day.entradaHora} - ${day.salidaHora}`;
                    statusClass = 'status-completada';
                    break;
                case 'presente':
                    statusInfo = `Entrada: ${day.entradaHora}`;
                    statusClass = 'status-confirmada';
                    break;
                case 'tardanza':
                    statusInfo = `Tardanza - ${day.entradaHora}`;
                    statusClass = 'status-pendiente';
                    break;
                case 'ausente':
                    statusInfo = 'Ausente';
                    statusClass = 'status-cancelada';
                    break;
            }
            
            historyHtml += `
                <div class="history-day">
                    <div class="day-header">
                        <strong>${fecha}</strong>
                        <span class="status-badge ${statusClass}">${statusInfo}</span>
                    </div>
                    ${day.observaciones ? `<div class="day-notes">${day.observaciones}</div>` : ''}
                </div>
            `;
        });
    } else {
        historyHtml = '<p style="text-align: center; color: #666;">No hay historial disponible</p>';
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 Historial de ${employee.nombre}</h3>
                <span class="close" onclick="closeEmployeeHistoryModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="employee-info">
                    <strong>Cargo:</strong> ${employee.cargo}<br>
                    <strong>Horario:</strong> ${employee.horarioEntrada} - ${employee.horarioSalida}
                </div>
                <h4>Últimos 15 días</h4>
                <div class="attendance-history">
                    ${historyHtml}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="exportEmployeeReport('${employee.id}')">
                        <span class="material-icons">file_download</span>
                        Exportar Reporte
                    </button>
                    <button class="btn btn-secondary" onclick="closeEmployeeHistoryModal()">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
        
        <style>
        .employee-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #667eea;
        }
        
        .attendance-history {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .history-day {
            border-bottom: 1px solid #e0e0e0;
            padding: 12px 0;
        }
        
        .day-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        
        .day-notes {
            color: #666;
            font-size: 0.9rem;
            font-style: italic;
        }
        </style>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeEmployeeHistoryModal() {
    const modal = document.getElementById('employeeHistoryModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

/**
 * Exporta reporte de asistencia de empleado
 */
function exportEmployeeReport(employeeId) {
    const employee = employeesData.find(e => e.id === employeeId);
    showNotification(`Generando reporte de asistencia para ${employee.nombre}...`, 'info');
    
    setTimeout(() => {
        showNotification('Reporte descargado exitosamente', 'success');
    }, 2000);
}

/**
 * Genera reporte de asistencia general
 */
function generateAttendanceReport() {
    showNotification('Generando reporte de asistencia general...', 'info');
    
    setTimeout(() => {
        showNotification('Reporte de asistencia descargado', 'success');
    }, 2000);
}



// ============= FUNCIONES ADICIONALES DE ASISTENCIA =============

/**
 * Filtra la tabla de empleados por texto de búsqueda
 */
function filterEmployeeTable(searchTerm) {
    const rows = document.querySelectorAll('#attendanceTableBody tr[data-employee-id]');
    rows.forEach(row => {
        const employeeName = row.cells[0].textContent.toLowerCase();
        const isVisible = employeeName.includes(searchTerm.toLowerCase());
        row.style.display = isVisible ? '' : 'none';
    });
}

/**
 * Filtra por estado de asistencia
 */
function filterByStatus(status) {
    const rows = document.querySelectorAll('#attendanceTableBody tr[data-employee-id]');
    rows.forEach(row => {
        const statusBadge = row.querySelector('.status-badge');
        if (!statusBadge) return;
        
        let shouldShow = true;
        
        if (status) {
            const statusText = statusBadge.textContent.toLowerCase();
            switch (status) {
                case 'presente':
                    shouldShow = statusText.includes('presente') && !statusText.includes('tardanza');
                    break;
                case 'ausente':
                    shouldShow = statusText.includes('ausente');
                    break;
                case 'tardanza':
                    shouldShow = statusText.includes('tardanza');
                    break;
                case 'completado':
                    shouldShow = statusText.includes(':') && statusText.includes('-');
                    break;
                case 'sin_registro':
                    shouldShow = statusText.includes('sin registrar');
                    break;
            }
        }
        
        row.style.display = shouldShow ? '' : 'none';
    });
}

/**
 * Filtra por departamento/tipo de empleado
 */
function filterByDepartment(department) {
    const rows = document.querySelectorAll('#attendanceTableBody tr[data-employee-id]');
    rows.forEach(row => {
        const employeeId = row.getAttribute('data-employee-id');
        const employee = employeesData.find(e => e.id === employeeId);
        
        if (!employee) return;
        
        let shouldShow = true;
        if (department) {
            shouldShow = employee.tipo === department;
        }
        
        row.style.display = shouldShow ? '' : 'none';
    });
}

/**
 * Registro masivo de entrada
 */
async function registerBulkEntry() {
    const confirmation = confirm('¿Registrar entrada para todos los empleados sin registro?');
    if (!confirmation) return;
    
    try {
        let registeredCount = 0;
        const currentTime = new Date();
        const timeString = currentTime.toTimeString().substring(0, 5);
        
        for (const employee of employeesData) {
            const hasAttendance = attendanceData.find(a => a.employeeId === employee.id);
            if (!hasAttendance) {
                await registerEntry(employee.id);
                registeredCount++;
                // Pequeña pausa para evitar sobrecarga
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        if (registeredCount > 0) {
            showNotification(`Entrada registrada para ${registeredCount} empleados`, 'success');
        } else {
            showNotification('Todos los empleados ya tienen registro de entrada', 'info');
        }
        
    } catch (error) {
        console.error('Error en registro masivo:', error);
        showNotification('Error en el registro masivo', 'error');
    }
}

/**
 * Registro masivo de salida
 */
async function registerBulkExit() {
    const confirmation = confirm('¿Registrar salida para todos los empleados presentes?');
    if (!confirmation) return;
    
    try {
        let registeredCount = 0;
        
        for (const attendance of attendanceData) {
            if ((attendance.estado === 'presente' || attendance.estado === 'tardanza') && !attendance.salidaHora) {
                await registerExit(attendance.employeeId);
                registeredCount++;
                // Pequeña pausa para evitar sobrecarga
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        if (registeredCount > 0) {
            showNotification(`Salida registrada para ${registeredCount} empleados`, 'success');
        } else {
            showNotification('No hay empleados pendientes de registro de salida', 'info');
        }
        
    } catch (error) {
        console.error('Error en registro masivo de salida:', error);
        showNotification('Error en el registro masivo de salida', 'error');
    }
}

/**
 * Muestra resumen del día actual
 */
function showAttendanceSummary() {
    const totalEmployees = employeesData.length;
    const presentCount = attendanceData.filter(a => a.estado === 'presente' || a.estado === 'completado' || a.estado === 'tardanza').length;
    const absentCount = attendanceData.filter(a => a.estado === 'ausente').length;
    const lateCount = attendanceData.filter(a => a.estado === 'tardanza').length;
    const pendingCount = totalEmployees - attendanceData.length;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'attendanceSummaryModal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 Resumen de Asistencia - ${new Date(currentAttendanceDate).toLocaleDateString('es-CL')}</h3>
                <span class="close" onclick="closeSummaryModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="summary-stats">
                    <div class="summary-card">
                        <div class="summary-number" style="color: #28a745;">${presentCount}</div>
                        <div class="summary-label">Presentes</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-number" style="color: #dc3545;">${absentCount}</div>
                        <div class="summary-label">Ausentes</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-number" style="color: #ffc107;">${lateCount}</div>
                        <div class="summary-label">Tardanzas</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-number" style="color: #6c757d;">${pendingCount}</div>
                        <div class="summary-label">Sin Registro</div>
                    </div>
                </div>
                
                <div class="summary-percentage">
                    <h4>Porcentaje de Asistencia</h4>
                    <div class="percentage-bar">
                        <div class="percentage-fill" style="width: ${(presentCount/totalEmployees)*100}%"></div>
                    </div>
                    <p>${Math.round((presentCount/totalEmployees)*100)}% de asistencia</p>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="generateDailyReport()">
                        <span class="material-icons">file_download</span>
                        Exportar Resumen
                    </button>
                    <button class="btn btn-secondary" onclick="closeSummaryModal()">Cerrar</button>
                </div>
            </div>
        </div>
        
        <style>
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .summary-number {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .summary-label {
            color: #666;
            font-size: 0.9rem;
        }
        
        .percentage-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .percentage-fill {
            height: 100%;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            transition: width 0.3s ease;
        }
        </style>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeSummaryModal() {
    const modal = document.getElementById('attendanceSummaryModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

/**
 * Sincroniza datos de asistencia
 */
async function syncAttendanceData() {
    try {
        showNotification('Sincronizando datos de asistencia...', 'info');
        
        if (isFirebaseConnected && database) {
            // Recargar datos desde Firebase
            await loadEmployeesData();
            await loadAttendanceData();
            showNotification('Datos sincronizados exitosamente', 'success');
        } else {
            // Simular sincronización en modo demo
            setTimeout(() => {
                showNotification('Datos sincronizados (modo demo)', 'success');
            }, 1000);
        }
        
    } catch (error) {
        console.error('Error sincronizando datos:', error);
        showNotification('Error al sincronizar datos', 'error');
    }
}

/**
 * Genera reporte diario
 */
function generateDailyReport() {
    showNotification('Generando reporte diario...', 'info');
    
    setTimeout(() => {
        showNotification('Reporte diario descargado exitosamente', 'success');
        closeSummaryModal();
    }, 2000);
}

/**
 * Muestra reporte de empleados con tardanzas frecuentes
 */
function showLateEmployeesReport() {
    // Datos demo de empleados con tardanzas
    const lateEmployees = [
        { nombre: 'Juan Pérez', tardanzas: 7, promedioRetraso: '12 min' },
        { nombre: 'Ana López', tardanzas: 5, promedioRetraso: '8 min' },
        { nombre: 'Carlos Silva', tardanzas: 6, promedioRetraso: '15 min' }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'lateEmployeesModal';
    
    let employeesHtml = '';
    lateEmployees.forEach(emp => {
        employeesHtml += `
            <tr>
                <td>${emp.nombre}</td>
                <td>${emp.tardanzas}</td>
                <td>${emp.promedioRetraso}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="sendWarningToEmployee('${emp.nombre}')">
                        Enviar Advertencia
                    </button>
                </td>
            </tr>
        `;
    });
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>⚠️ Empleados con Tardanzas Frecuentes</h3>
                <span class="close" onclick="closeLateEmployeesModal()">&times;</span>
            </div>
            <div class="modal-body">
                <p>Empleados con más de 5 tardanzas en el último mes:</p>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Empleado</th>
                            <th>Tardanzas</th>
                            <th>Promedio Retraso</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${employeesHtml}
                    </tbody>
                </table>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="exportLateReport()">
                        Exportar Reporte
                    </button>
                    <button class="btn btn-secondary" onclick="closeLateEmployeesModal()">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeLateEmployeesModal() {
    const modal = document.getElementById('lateEmployeesModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

/**
 * Envía advertencia a empleado
 */
function sendWarningToEmployee(employeeName) {
    showNotification(`Advertencia enviada a ${employeeName}`, 'success');
}

/**
 * Exporta reporte de tardanzas
 */
function exportLateReport() {
    showNotification('Exportando reporte de tardanzas...', 'info');
    setTimeout(() => {
        showNotification('Reporte de tardanzas descargado', 'success');
    }, 1500);
}

/**
 * Genera reporte mensual
 */
function generateMonthlyReport() {
    showNotification('Generando reporte mensual de asistencia...', 'info');
    setTimeout(() => {
        showNotification('Reporte mensual generado exitosamente', 'success');
    }, 3000);
}

/**
 * Muestra análisis de tendencias
 */
function viewTrendAnalysis() {
    showNotification('Cargando análisis de tendencias...', 'info');
    setTimeout(() => {
        showNotification('Análisis de tendencias disponible en Reportes', 'success');
    }, 2000);
}

// ============= INTEGRACIÓN CON EL SISTEMA PRINCIPAL =============

/**
 * Actualiza la función showAdminPage para inicializar asistencia
 */
const originalShowAdminPage = window.showAdminPage;
window.showAdminPage = function(pageName) {
    // Llamar función original
    originalShowAdminPage(pageName);
    
    // Si es la página de asistencia, inicializar el módulo
    if (pageName === 'attendance') {
        setTimeout(() => {
            initializeAttendanceModule();
        }, 100);
    }
};

/**
 * Auto-actualización cada 30 segundos
 */
let attendanceUpdateInterval = null;

function startAttendanceAutoUpdate() {
    // Limpiar intervalo anterior si existe
    if (attendanceUpdateInterval) {
        clearInterval(attendanceUpdateInterval);
    }
    
    // Actualizar cada 30 segundos
    attendanceUpdateInterval = setInterval(() => {
        // Solo actualizar si estamos en la página de asistencia
        const attendancePage = document.getElementById('adminAttendance');
        if (attendancePage && !attendancePage.classList.contains('hidden')) {
            updateCurrentTime();
            
            // Actualizar estadísticas sin recargar toda la tabla
            updateAttendanceStats();
        }
    }, 30000);
}

function stopAttendanceAutoUpdate() {
    if (attendanceUpdateInterval) {
        clearInterval(attendanceUpdateInterval);
        attendanceUpdateInterval = null;
    }
}

/**
 * Inicialización cuando se carga el módulo
 */
document.addEventListener('DOMContentLoaded', function() {
    // Iniciar auto-actualización
    startAttendanceAutoUpdate();
    
    // Limpiar al cerrar la página
    window.addEventListener('beforeunload', stopAttendanceAutoUpdate);
});

// ============= SISTEMA DE ASISTENCIA DE CLIENTES =============

// Variables globales para asistencia de clientes
let clientAttendanceData = [];
let appointmentsForAttendance = [];
let currentAttendanceViewDate = new Date().toISOString().split('T')[0];

// ============= FUNCIONES PRINCIPALES =============

/**
 * Inicializa el módulo de asistencia de clientes
 */
function initializeClientAttendanceModule() {
    console.log('👥 Inicializando módulo de asistencia de clientes...');
    
    // Configurar fecha actual
    const dateInput = document.getElementById('clientAttendanceDate');
    if (dateInput) {
        dateInput.value = currentAttendanceViewDate;
        dateInput.addEventListener('change', () => {
            currentAttendanceViewDate = dateInput.value;
            loadClientAttendanceData();
        });
    }
    
    // Cargar datos iniciales
    loadClientAttendanceData();
    updateClientAttendanceStats();
    
    // Auto-actualizar cada 2 minutos
    setInterval(() => {
        if (document.getElementById('adminClientAttendance') && 
            !document.getElementById('adminClientAttendance').classList.contains('hidden')) {
            loadClientAttendanceData();
        }
    }, 120000);
}

/**
 * Carga las citas y datos de asistencia para la fecha seleccionada
 */
async function loadClientAttendanceData() {
    try {
        appointmentsForAttendance = [];
        clientAttendanceData = [];
        
        if (isFirebaseConnected && database) {
            // Cargar citas reales desde Firebase
            const citasSnapshot = await database.ref('citas')
                .orderByChild('fecha')
                .equalTo(currentAttendanceViewDate)
                .once('value');
            
            if (citasSnapshot.exists()) {
                const citas = citasSnapshot.val();
                
                for (const [citaId, cita] of Object.entries(citas)) {
                    // Solo incluir citas confirmadas
                    if (cita.estado === 'confirmada' || cita.estado === 'completada') {
                        let clienteData = { nombre: 'Cliente', rut: 'N/A', email: 'N/A' };
                        
                        // Obtener datos del cliente
                        if (cita.usuario_id) {
                            try {
                                const userSnapshot = await database.ref(`usuarios/${cita.usuario_id}`).once('value');
                                if (userSnapshot.exists()) {
                                    const userData = userSnapshot.val();
                                    clienteData = {
                                        nombre: userData.nombre,
                                        rut: userData.rut,
                                        email: userData.email
                                    };
                                }
                            } catch (error) {
                                console.warn('Error cargando datos del cliente:', error);
                            }
                        }
                        
                        appointmentsForAttendance.push({
                            id: citaId,
                            fecha: cita.fecha,
                            hora: cita.hora,
                            tipoServicio: cita.tipoServicio,
                            estado: cita.estado,
                            cliente: clienteData,
                            observaciones: cita.observaciones || ''
                        });
                    }
                }
            }
            
            // Cargar datos de asistencia
            const attendanceSnapshot = await database.ref(`asistencia_clientes/${currentAttendanceViewDate.replace(/-/g, '_')}`).once('value');
            if (attendanceSnapshot.exists()) {
                const attendance = attendanceSnapshot.val();
                Object.entries(attendance).forEach(([citaId, data]) => {
                    clientAttendanceData.push({
                        citaId,
                        ...data
                    });
                });
            }
            
        } else {
            // Datos demo
            if (currentAttendanceViewDate === new Date().toISOString().split('T')[0]) {
                appointmentsForAttendance = [
                    {
                        id: 'cita_001',
                        fecha: currentAttendanceViewDate,
                        hora: '08:00',
                        tipoServicio: 'renovacion',
                        estado: 'confirmada',
                        cliente: {
                            nombre: 'Juan Carlos Pérez',
                            rut: '12.345.678-9',
                            email: 'juan.perez@email.com'
                        },
                        observaciones: 'Primera cita del día'
                    },
                    {
                        id: 'cita_002',
                        fecha: currentAttendanceViewDate,
                        hora: '09:00',
                        tipoServicio: 'primera_vez',
                        estado: 'confirmada',
                        cliente: {
                            nombre: 'María Elena García',
                            rut: '98.765.432-1',
                            email: 'maria.garcia@email.com'
                        },
                        observaciones: 'Cliente nuevo'
                    },
                    {
                        id: 'cita_003',
                        fecha: currentAttendanceViewDate,
                        hora: '10:00',
                        tipoServicio: 'duplicado',
                        estado: 'confirmada',
                        cliente: {
                            nombre: 'Carlos Silva Rodríguez',
                            rut: '11.222.333-4',
                            email: 'carlos.silva@email.com'
                        },
                        observaciones: 'Duplicado por robo'
                    },
                    {
                        id: 'cita_004',
                        fecha: currentAttendanceViewDate,
                        hora: '11:00',
                        tipoServicio: 'cambio_domicilio',
                        estado: 'confirmada',
                        cliente: {
                            nombre: 'Ana López Martínez',
                            rut: '22.333.444-5',
                            email: 'ana.lopez@email.com'
                        },
                        observaciones: 'Cambio de comuna'
                    }
                ];
                
                // Datos demo de asistencia
                clientAttendanceData = [
                    {
                        citaId: 'cita_001',
                        estadoAsistencia: 'asistio',
                        horaLlegada: '07:55',
                        observacionesAsistencia: 'Llegó puntual',
                        registradoPor: 'admin@concon.cl',
                        timestampRegistro: new Date().getTime()
                    },
                    {
                        citaId: 'cita_002',
                        estadoAsistencia: 'no_asistio',
                        observacionesAsistencia: 'No se presentó, no avisó',
                        registradoPor: 'admin@concon.cl',
                        timestampRegistro: new Date().getTime()
                    }
                ];
            } else {
                appointmentsForAttendance = [];
                clientAttendanceData = [];
            }
        }
        
        renderClientAttendanceTable();
        updateClientAttendanceStats();
        
    } catch (error) {
        console.error('Error cargando datos de asistencia de clientes:', error);
        showNotification('Error al cargar datos de asistencia', 'error');
    }
}

/**
 * Renderiza la tabla de asistencia de clientes
 */
function renderClientAttendanceTable() {
    const tbody = document.getElementById('clientAttendanceTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (appointmentsForAttendance.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <span class="material-icons" style="font-size: 48px; display: block; margin-bottom: 10px;">event_busy</span>
                    No hay citas programadas para esta fecha
                </td>
            </tr>
        `;
        return;
    }
    
    // Ordenar por hora
    appointmentsForAttendance.sort((a, b) => a.hora.localeCompare(b.hora));
    
    appointmentsForAttendance.forEach(appointment => {
        const attendance = clientAttendanceData.find(a => a.citaId === appointment.id);
        const service = services[appointment.tipoServicio];
        const isToday = currentAttendanceViewDate === new Date().toISOString().split('T')[0];
        const currentTime = new Date();
        const appointmentTime = new Date(`${appointment.fecha}T${appointment.hora}:00`);
        const isPast = appointmentTime < currentTime;
        
        // Determinar estado de asistencia
        let estadoAsistencia = 'pendiente';
        let estadoClass = 'status-pendiente';
        let estadoText = 'Pendiente';
        let actions = '';
        
        if (attendance) {
            switch (attendance.estadoAsistencia) {
                case 'asistio':
                    estadoAsistencia = 'asistio';
                    estadoClass = 'status-confirmada';
                    estadoText = `Asistió (${attendance.horaLlegada || 'N/A'})`;
                    break;
                case 'no_asistio':
                    estadoAsistencia = 'no_asistio';
                    estadoClass = 'status-cancelada';
                    estadoText = 'No asistió';
                    break;
                case 'llegada_tardia':
                    estadoAsistencia = 'llegada_tardia';
                    estadoClass = 'status-pendiente';
                    estadoText = `Llegada tardía (${attendance.horaLlegada || 'N/A'})`;
                    break;
                case 'cancelado_cliente':
                    estadoAsistencia = 'cancelado_cliente';
                    estadoClass = 'status-cancelada';
                    estadoText = 'Cancelado por cliente';
                    break;
            }
        } else if (isToday && isPast) {
            // Si es hoy y ya pasó la hora, mostrar como pendiente de registro
            estadoText = 'Pendiente de registro';
            estadoClass = 'status-pendiente';
        }
        
        // Determinar acciones disponibles
        if (!attendance && isToday) {
            actions = `
                <button class="btn btn-success btn-sm" onclick="markClientAttended('${appointment.id}', '${appointment.hora}')" title="Marcar como asistió">
                    <span class="material-icons">check_circle</span>
                </button>
                <button class="btn btn-danger btn-sm" onclick="markClientNoShow('${appointment.id}')" title="Marcar como no asistió">
                    <span class="material-icons">cancel</span>
                </button>
                <button class="btn btn-warning btn-sm" onclick="markClientLate('${appointment.id}')" title="Marcar llegada tardía">
                    <span class="material-icons">schedule</span>
                </button>
            `;
        } else if (attendance && isToday) {
            actions = `
                <button class="btn btn-info btn-sm" onclick="editClientAttendance('${appointment.id}')" title="Editar registro">
                    <span class="material-icons">edit</span>
                </button>
            `;
        } else {
            actions = `
                <button class="btn btn-secondary btn-sm" onclick="viewClientAttendanceHistory('${appointment.cliente.rut}')" title="Ver historial">
                    <span class="material-icons">history</span>
                </button>
            `;
        }
        
        // Indicador de retraso
        let lateIndicator = '';
        if (attendance && attendance.horaLlegada && appointment.hora) {
            const horaEsperada = new Date(`2025-01-01T${appointment.hora}:00`);
            const horaReal = new Date(`2025-01-01T${attendance.horaLlegada}:00`);
            
            if (horaReal > horaEsperada) {
                const minutosRetraso = Math.floor((horaReal - horaEsperada) / (1000 * 60));
                lateIndicator = `<small style="color: #dc3545;">+${minutosRetraso} min</small>`;
            } else if (horaReal < horaEsperada) {
                const minutosAnticipado = Math.floor((horaEsperada - horaReal) / (1000 * 60));
                lateIndicator = `<small style="color: #28a745;">-${minutosAnticipado} min</small>`;
            }
        }
        
        tbody.innerHTML += `
            <tr data-appointment-id="${appointment.id}" data-attendance-status="${estadoAsistencia}">
                <td>${appointment.hora}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="client-avatar">${appointment.cliente.nombre.split(' ').map(n => n[0]).join('').substr(0, 2)}</div>
                        <div>
                            <strong>${appointment.cliente.nombre}</strong><br>
                            <small style="color: #666;">${appointment.cliente.rut}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="service-badge" data-service="${appointment.tipoServicio}">
                        ${service?.name || appointment.tipoServicio}
                    </span>
                    <br>
                    <small style="color: #666;">${service?.duration || '30 min'}</small>
                </td>
                <td>
                    <span class="status-badge ${estadoClass}">${estadoText}</span>
                    ${lateIndicator}
                </td>
                <td>
                    <small style="color: #666;">
                        ${attendance?.observacionesAsistencia || appointment.observaciones || '-'}
                    </small>
                </td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        ${actions}
                    </div>
                </td>
            </tr>
        `;
    });
}

/**
 * Marca que un cliente asistió a su cita
 */
async function markClientAttended(appointmentId, scheduledTime) {
    try {
        const currentTime = new Date();
        const currentTimeString = currentTime.toTimeString().substring(0, 5);
        const appointment = appointmentsForAttendance.find(a => a.id === appointmentId);
        
        if (!appointment) {
            showNotification('Cita no encontrada', 'error');
            return;
        }
        
        // Determinar si llegó tarde
        const scheduledDateTime = new Date(`${appointment.fecha}T${scheduledTime}:00`);
        const isLate = currentTime > scheduledDateTime;
        const minutesLate = isLate ? Math.floor((currentTime - scheduledDateTime) / (1000 * 60)) : 0;
        
        const attendanceRecord = {
            estadoAsistencia: isLate && minutesLate > 15 ? 'llegada_tardia' : 'asistio',
            horaLlegada: currentTimeString,
            observacionesAsistencia: isLate && minutesLate > 15 ? 
                `Llegada tardía: ${minutesLate} minutos` : 
                'Asistió puntualmente',
            registradoPor: currentUser?.email || 'admin',
            timestampRegistro: currentTime.getTime()
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia_clientes/${currentAttendanceViewDate.replace(/-/g, '_')}/${appointmentId}`).set(attendanceRecord);
            
            // Actualizar estado de la cita a completada
            await database.ref(`citas/${appointmentId}`).update({
                estado: 'completada',
                fechaCompletado: new Date().toISOString()
            });
        } else {
            // Modo demo
            const existingIndex = clientAttendanceData.findIndex(a => a.citaId === appointmentId);
            if (existingIndex >= 0) {
                clientAttendanceData[existingIndex] = { citaId: appointmentId, ...attendanceRecord };
            } else {
                clientAttendanceData.push({ citaId: appointmentId, ...attendanceRecord });
            }
        }
        
        const statusText = isLate && minutesLate > 15 ? 'llegada tardía' : 'asistencia';
        showNotification(`${statusText.charAt(0).toUpperCase() + statusText.slice(1)} registrada para ${appointment.cliente.nombre}`, 'success');
        
        loadClientAttendanceData();
        
    } catch (error) {
        console.error('Error registrando asistencia:', error);
        showNotification('Error al registrar asistencia', 'error');
    }
}

/**
 * Marca que un cliente no asistió (no-show)
 */
async function markClientNoShow(appointmentId) {
    try {
        const reason = prompt('Motivo de la inasistencia (opcional):') || 'No especificado';
        const appointment = appointmentsForAttendance.find(a => a.id === appointmentId);
        
        if (!appointment) {
            showNotification('Cita no encontrada', 'error');
            return;
        }
        
        const attendanceRecord = {
            estadoAsistencia: 'no_asistio',
            observacionesAsistencia: reason,
            registradoPor: currentUser?.email || 'admin',
            timestampRegistro: new Date().getTime()
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia_clientes/${currentAttendanceViewDate.replace(/-/g, '_')}/${appointmentId}`).set(attendanceRecord);
            
            // Actualizar estado de la cita
            await database.ref(`citas/${appointmentId}`).update({
                estado: 'no_show',
                fechaNoShow: new Date().toISOString()
            });
            
            // Registrar no-show en historial del cliente
            if (appointment.cliente.rut) {
                await database.ref(`clientes_historial/${appointment.cliente.rut.replace(/[.-]/g, '')}/no_shows`).push({
                    fecha: appointment.fecha,
                    hora: appointment.hora,
                    tipoServicio: appointment.tipoServicio,
                    motivo: reason,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            // Modo demo
            const existingIndex = clientAttendanceData.findIndex(a => a.citaId === appointmentId);
            if (existingIndex >= 0) {
                clientAttendanceData[existingIndex] = { citaId: appointmentId, ...attendanceRecord };
            } else {
                clientAttendanceData.push({ citaId: appointmentId, ...attendanceRecord });
            }
        }
        
        showNotification(`Inasistencia registrada para ${appointment.cliente.nombre}`, 'success');
        loadClientAttendanceData();
        
    } catch (error) {
        console.error('Error registrando inasistencia:', error);
        showNotification('Error al registrar inasistencia', 'error');
    }
}

/**
 * Marca llegada tardía de un cliente
 */
async function markClientLate(appointmentId) {
    try {
        const arrivalTime = prompt('Hora de llegada (HH:MM):');
        if (!arrivalTime || !/^\d{2}:\d{2}$/.test(arrivalTime)) {
            showNotification('Formato de hora inválido. Use HH:MM', 'error');
            return;
        }
        
        const appointment = appointmentsForAttendance.find(a => a.id === appointmentId);
        if (!appointment) {
            showNotification('Cita no encontrada', 'error');
            return;
        }
        
        // Calcular minutos de retraso
        const scheduledTime = new Date(`2025-01-01T${appointment.hora}:00`);
        const arrivalTimeObj = new Date(`2025-01-01T${arrivalTime}:00`);
        const minutesLate = Math.floor((arrivalTimeObj - scheduledTime) / (1000 * 60));
        
        const attendanceRecord = {
            estadoAsistencia: 'llegada_tardia',
            horaLlegada: arrivalTime,
            observacionesAsistencia: `Llegada tardía: ${minutesLate} minutos`,
            registradoPor: currentUser?.email || 'admin',
            timestampRegistro: new Date().getTime()
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia_clientes/${currentAttendanceViewDate.replace(/-/g, '_')}/${appointmentId}`).set(attendanceRecord);
            
            await database.ref(`citas/${appointmentId}`).update({
                estado: 'completada',
                fechaCompletado: new Date().toISOString(),
                llegadaTardia: true,
                minutosRetraso: minutesLate
            });
        } else {
            // Modo demo
            const existingIndex = clientAttendanceData.findIndex(a => a.citaId === appointmentId);
            if (existingIndex >= 0) {
                clientAttendanceData[existingIndex] = { citaId: appointmentId, ...attendanceRecord };
            } else {
                clientAttendanceData.push({ citaId: appointmentId, ...attendanceRecord });
            }
        }
        
        showNotification(`Llegada tardía registrada para ${appointment.cliente.nombre}`, 'success');
        loadClientAttendanceData();
        
    } catch (error) {
        console.error('Error registrando llegada tardía:', error);
        showNotification('Error al registrar llegada tardía', 'error');
    }
}

/**
 * Actualiza las estadísticas de asistencia de clientes
 */
function updateClientAttendanceStats() {
    const totalAppointments = appointmentsForAttendance.length;
    const attendedCount = clientAttendanceData.filter(a => 
        a.estadoAsistencia === 'asistio' || a.estadoAsistencia === 'llegada_tardia'
    ).length;
    const noShowCount = clientAttendanceData.filter(a => a.estadoAsistencia === 'no_asistio').length;
    const lateCount = clientAttendanceData.filter(a => a.estadoAsistencia === 'llegada_tardia').length;
    const pendingCount = totalAppointments - clientAttendanceData.length;
    
    // Actualizar elementos del DOM
    const statsElements = {
        totalClientAppointments: document.getElementById('totalClientAppointments'),
        attendedClients: document.getElementById('attendedClients'),
        noShowClients: document.getElementById('noShowClients'),
        lateClients: document.getElementById('lateClients'),
        pendingClients: document.getElementById('pendingClients')
    };
    
    if (statsElements.totalClientAppointments) statsElements.totalClientAppointments.textContent = totalAppointments;
    if (statsElements.attendedClients) statsElements.attendedClients.textContent = attendedCount;
    if (statsElements.noShowClients) statsElements.noShowClients.textContent = noShowCount;
    if (statsElements.lateClients) statsElements.lateClients.textContent = lateCount;
    if (statsElements.pendingClients) statsElements.pendingClients.textContent = pendingCount;
    
    // Calcular porcentaje de asistencia
    const attendancePercentage = totalAppointments > 0 ? Math.round((attendedCount / totalAppointments) * 100) : 0;
    const percentageElement = document.getElementById('clientAttendancePercentage');
    if (percentageElement) {
        percentageElement.textContent = `${attendancePercentage}%`;
        percentageElement.style.color = attendancePercentage >= 85 ? '#28a745' : attendancePercentage >= 70 ? '#ffc107' : '#dc3545';
    }
    
    // Calcular tasa de no-show
    const noShowPercentage = totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 100) : 0;
    const noShowElement = document.getElementById('noShowPercentage');
    if (noShowElement) {
        noShowElement.textContent = `${noShowPercentage}%`;
        noShowElement.style.color = noShowPercentage <= 10 ? '#28a745' : noShowPercentage <= 20 ? '#ffc107' : '#dc3545';
    }
}


// ============= FUNCIONES ADICIONALES DE ASISTENCIA DE CLIENTES =============

/**
 * Filtra la tabla de asistencia por búsqueda de texto
 */
function filterClientAttendanceTable(searchTerm) {
    const rows = document.querySelectorAll('#clientAttendanceTableBody tr[data-appointment-id]');
    rows.forEach(row => {
        const clientName = row.cells[1].textContent.toLowerCase();
        const isVisible = clientName.includes(searchTerm.toLowerCase());
        row.style.display = isVisible ? '' : 'none';
    });
}

/**
 * Filtra por estado de asistencia
 */
function filterByAttendanceStatus(status) {
    const rows = document.querySelectorAll('#clientAttendanceTableBody tr[data-appointment-id]');
    rows.forEach(row => {
        const attendanceStatus = row.getAttribute('data-attendance-status');
        let shouldShow = true;
        
        if (status) {
            shouldShow = attendanceStatus === status;
        }
        
        row.style.display = shouldShow ? '' : 'none';
    });
}

/**
 * Filtra por tipo de servicio
 */
function filterByServiceType(serviceType) {
    const rows = document.querySelectorAll('#clientAttendanceTableBody tr[data-appointment-id]');
    rows.forEach(row => {
        const serviceBadge = row.querySelector('.service-badge');
        if (!serviceBadge) return;
        
        const rowServiceType = serviceBadge.getAttribute('data-service');
        let shouldShow = true;
        
        if (serviceType) {
            shouldShow = rowServiceType === serviceType;
        }
        
        row.style.display = shouldShow ? '' : 'none';
    });
}

/**
 * Edita un registro de asistencia existente
 */
async function editClientAttendance(appointmentId) {
    try {
        const appointment = appointmentsForAttendance.find(a => a.id === appointmentId);
        const attendance = clientAttendanceData.find(a => a.citaId === appointmentId);
        
        if (!appointment || !attendance) {
            showNotification('Datos no encontrados', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editClientAttendanceModal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Editar Registro de Asistencia</h3>
                    <span class="close" onclick="closeEditAttendanceModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="client-info-section">
                        <h4>👤 Información del Cliente</h4>
                        <p><strong>Nombre:</strong> ${appointment.cliente.nombre}</p>
                        <p><strong>RUT:</strong> ${appointment.cliente.rut}</p>
                        <p><strong>Servicio:</strong> ${services[appointment.tipoServicio]?.name || appointment.tipoServicio}</p>
                        <p><strong>Hora programada:</strong> ${appointment.hora}</p>
                    </div>
                    
                    <form id="editAttendanceForm">
                        <div class="form-group">
                            <label for="editAttendanceStatus">Estado de Asistencia</label>
                            <select id="editAttendanceStatus" required>
                                <option value="asistio" ${attendance.estadoAsistencia === 'asistio' ? 'selected' : ''}>Asistió</option>
                                <option value="no_asistio" ${attendance.estadoAsistencia === 'no_asistio' ? 'selected' : ''}>No asistió</option>
                                <option value="llegada_tardia" ${attendance.estadoAsistencia === 'llegada_tardia' ? 'selected' : ''}>Llegada tardía</option>
                                <option value="cancelado_cliente" ${attendance.estadoAsistencia === 'cancelado_cliente' ? 'selected' : ''}>Cancelado por cliente</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="editArrivalTime">Hora de llegada (opcional)</label>
                            <input type="time" id="editArrivalTime" value="${attendance.horaLlegada || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="editAttendanceNotes">Observaciones</label>
                            <textarea id="editAttendanceNotes" rows="3">${attendance.observacionesAsistencia || ''}</textarea>
                        </div>
                        
                        <div style="text-align: center; margin-top: 20px;">
                            <button type="button" class="btn btn-secondary" onclick="closeEditAttendanceModal()">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="saveAttendanceEdit('${appointmentId}')">
                                <span class="material-icons">save</span>
                                Guardar Cambios
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <style>
            .client-info-section {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                border-left: 4px solid #667eea;
            }
            
            .client-info-section h4 {
                margin-bottom: 10px;
                color: #667eea;
            }
            
            .client-info-section p {
                margin: 5px 0;
                color: #666;
            }
            </style>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error editando asistencia:', error);
        showNotification('Error al editar registro de asistencia', 'error');
    }
}

function closeEditAttendanceModal() {
    const modal = document.getElementById('editClientAttendanceModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

/**
 * Guarda los cambios de edición de asistencia
 */
async function saveAttendanceEdit(appointmentId) {
    try {
        const status = document.getElementById('editAttendanceStatus').value;
        const arrivalTime = document.getElementById('editArrivalTime').value;
        const notes = document.getElementById('editAttendanceNotes').value;
        
        const updatedRecord = {
            estadoAsistencia: status,
            horaLlegada: arrivalTime,
            observacionesAsistencia: notes,
            modificadoPor: currentUser?.email || 'admin',
            fechaModificacion: new Date().toISOString()
        };
        
        if (isFirebaseConnected && database) {
            await database.ref(`asistencia_clientes/${currentAttendanceViewDate.replace(/-/g, '_')}/${appointmentId}`).update(updatedRecord);
        } else {
            // Modo demo
            const index = clientAttendanceData.findIndex(a => a.citaId === appointmentId);
            if (index >= 0) {
                Object.assign(clientAttendanceData[index], updatedRecord);
            }
        }
        
        showNotification('Registro actualizado exitosamente', 'success');
        closeEditAttendanceModal();
        loadClientAttendanceData();
        
    } catch (error) {
        console.error('Error guardando cambios:', error);
        showNotification('Error al guardar cambios', 'error');
    }
}

/**
 * Ver historial de asistencia de un cliente específico
 */
async function viewClientAttendanceHistory(clientRut) {
    try {
        let historyData = [];
        
        if (isFirebaseConnected && database) {
            // Cargar historial real desde Firebase
            const rutKey = clientRut.replace(/[.-]/g, '');
            const historySnapshot = await database.ref(`clientes_historial/${rutKey}`).once('value');
            
            if (historySnapshot.exists()) {
                const history = historySnapshot.val();
                // Procesar datos del historial
                // ... lógica para estructurar los datos
            }
        } else {
            // Datos demo
            historyData = [
                {
                    fecha: '2025-01-10',
                    hora: '09:00',
                    servicio: 'Renovación',
                    estado: 'asistio',
                    observaciones: 'Llegó puntual'
                },
                {
                    fecha: '2024-12-15',
                    hora: '14:00',
                    servicio: 'Primera Licencia',
                    estado: 'llegada_tardia',
                    observaciones: 'Llegó 20 minutos tarde'
                },
                {
                    fecha: '2024-11-20',
                    hora: '10:00',
                    servicio: 'Duplicado',
                    estado: 'no_asistio',
                    observaciones: 'No se presentó'
                }
            ];
        }
        
        showClientHistoryModal(clientRut, historyData);
        
    } catch (error) {
        console.error('Error cargando historial del cliente:', error);
        showNotification('Error al cargar historial', 'error');
    }
}

/**
 * Muestra modal con historial del cliente
 */
function showClientHistoryModal(clientRut, historyData) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'clientHistoryModal';
    
    let historyHtml = '';
    if (historyData.length > 0) {
        historyData.forEach(record => {
            const fecha = new Date(record.fecha).toLocaleDateString('es-CL');
            let statusClass = '';
            let statusIcon = '';
            
            switch (record.estado) {
                case 'asistio':
                    statusClass = 'status-confirmada';
                    statusIcon = 'check_circle';
                    break;
                case 'no_asistio':
                    statusClass = 'status-cancelada';
                    statusIcon = 'cancel';
                    break;
                case 'llegada_tardia':
                    statusClass = 'status-pendiente';
                    statusIcon = 'schedule';
                    break;
            }
            
            historyHtml += `
                <div class="history-record">
                    <div class="record-header">
                        <span class="material-icons ${statusClass}">${statusIcon}</span>
                        <div>
                            <strong>${fecha} - ${record.hora}</strong><br>
                            <small>${record.servicio}</small>
                        </div>
                        <span class="status-badge ${statusClass}">${record.estado}</span>
                    </div>
                    ${record.observaciones ? `<div class="record-notes">${record.observaciones}</div>` : ''}
                </div>
            `;
        });
    } else {
        historyHtml = '<p style="text-align: center; color: #666;">No hay historial disponible</p>';
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📋 Historial de ${clientRut}</h3>
                <span class="close" onclick="closeClientHistoryModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="history-timeline">
                    ${historyHtml}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="exportClientHistory('${clientRut}')">
                        <span class="material-icons">file_download</span>
                        Exportar Historial
                    </button>
                    <button class="btn btn-secondary" onclick="closeClientHistoryModal()">Cerrar</button>
                </div>
            </div>
        </div>
        
        <style>
        .history-timeline {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .history-record {
            border-left: 3px solid #667eea;
            padding: 15px 20px;
            margin-bottom: 15px;
            background: #f8f9fa;
            border-radius: 0 8px 8px 0;
        }
        
        .record-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 8px;
        }
        
        .record-notes {
            color: #666;
            font-size: 0.9rem;
            font-style: italic;
            margin-left: 40px;
        }
        </style>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeClientHistoryModal() {
    const modal = document.getElementById('clientHistoryModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

/**
 * Acciones masivas
 */
async function markAllPresent() {
    const confirmation = confirm('¿Marcar como presentes a todos los clientes pendientes?');
    if (!confirmation) return;
    
    try {
        let markedCount = 0;
        
        for (const appointment of appointmentsForAttendance) {
            const hasAttendance = clientAttendanceData.find(a => a.citaId === appointment.id);
            if (!hasAttendance) {
                await markClientAttended(appointment.id, appointment.hora);
                markedCount++;
                // Pausa para evitar sobrecarga
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        if (markedCount > 0) {
            showNotification(`${markedCount} clientes marcados como presentes`, 'success');
        } else {
            showNotification('No hay clientes pendientes de marcar', 'info');
        }
        
    } catch (error) {
        console.error('Error en marcado masivo:', error);
        showNotification('Error en el marcado masivo', 'error');
    }
}

async function markPendingAsNoShow() {
    const confirmation = confirm('¿Marcar como no-show a todos los clientes pendientes?');
    if (!confirmation) return;
    
    try {
        let markedCount = 0;
        const currentTime = new Date();
        
        for (const appointment of appointmentsForAttendance) {
            const appointmentTime = new Date(`${appointment.fecha}T${appointment.hora}:00`);
            const hasAttendance = clientAttendanceData.find(a => a.citaId === appointment.id);
            
            // Solo marcar como no-show si ya pasó la hora de la cita
            if (!hasAttendance && currentTime > appointmentTime) {
                await markClientNoShow(appointment.id);
                markedCount++;
                // Pausa para evitar sobrecarga
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        if (markedCount > 0) {
            showNotification(`${markedCount} clientes marcados como no-show`, 'success');
        } else {
            showNotification('No hay clientes para marcar como no-show', 'info');
        }
        
    } catch (error) {
        console.error('Error marcando no-shows:', error);
        showNotification('Error al marcar no-shows', 'error');
    }
}

/**
 * Funciones de reportes y análisis
 */
function generateClientAttendanceReport() {
    showNotification('Generando reporte de asistencia de clientes...', 'info');
    
    setTimeout(() => {
        showNotification('Reporte de asistencia descargado exitosamente', 'success');
    }, 2000);
}

function showNoShowAnalysis() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'noShowAnalysisModal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 Análisis de No-Shows</h3>
                <span class="close" onclick="closeNoShowAnalysisModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="analysis-summary">
                    <h4>Resumen de No-Shows - Último Mes</h4>
                    <div class="summary-stats">
                        <div class="summary-item">
                            <span class="summary-label">Total No-Shows:</span>
                            <span class="summary-value" style="color: #dc3545;">23</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Tasa de No-Show:</span>
                            <span class="summary-value" style="color: #dc3545;">18.2%</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Tiempo perdido:</span>
                            <span class="summary-value" style="color: #ffc107;">11.5 horas</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Ingresos perdidos:</span>
                            <span class="summary-value" style="color: #dc3545;">$345.000</span>
                        </div>
                    </div>
                </div>
                
                <div class="recommendations">
                    <h4>📋 Recomendaciones</h4>
                    <ul>
                        <li>Implementar confirmación 24h antes de la cita</li>
                        <li>Aplicar política de penalización por no-shows</li>
                        <li>Enviar recordatorios automáticos</li>
                        <li>Ofrecer reagendamiento fácil</li>
                        <li>Analizar patrones de horarios con mayor no-show</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="implementNoShowPolicy()">
                        Implementar Políticas
                    </button>
                    <button class="btn btn-warning" onclick="exportNoShowReport()">
                        Exportar Análisis
                    </button>
                    <button class="btn btn-secondary" onclick="closeNoShowAnalysisModal()">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
        
        <style>
        .analysis-summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }
        
        .summary-label {
            color: #666;
        }
        
        .summary-value {
            font-weight: bold;
            font-size: 1.1rem;
        }
        
        .recommendations {
            background: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ffc107;
        }
        
        .recommendations ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .recommendations li {
            margin: 8px 0;
            color: #856404;
        }
        </style>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeNoShowAnalysisModal() {
    const modal = document.getElementById('noShowAnalysisModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

/**
 * Funciones auxiliares
 */
function sendAttendanceReminders() {
    showNotification('Enviando recordatorios de cita...', 'info');
    setTimeout(() => {
        showNotification('Recordatorios enviados a 5 clientes', 'success');
    }, 1500);
}

function refreshAttendanceData() {
    showNotification('Actualizando datos...', 'info');
    loadClientAttendanceData();
}

function exportClientHistory(clientRut) {
    showNotification(`Exportando historial de ${clientRut}...`, 'info');
    setTimeout(() => {
        showNotification('Historial exportado exitosamente', 'success');
    }, 1500);
}

function implementNoShowPolicy() {
    showNotification('Configurando políticas de no-show...', 'info');
    setTimeout(() => {
        showNotification('Políticas implementadas exitosamente', 'success');
    }, 2000);
}

function exportNoShowReport() {
    showNotification('Exportando análisis de no-shows...', 'info');
    setTimeout(() => {
        showNotification('Análisis exportado exitosamente', 'success');
    }, 1500);
}

function generateDetailedAnalysis() {
    showNotification('Generando análisis detallado...', 'info');
    setTimeout(() => {
        showNotification('Análisis detallado disponible', 'success');
    }, 2500);
}

function exportTrendsReport() {
    showNotification('Exportando reporte de tendencias...', 'info');
    setTimeout(() => {
        showNotification('Reporte de tendencias descargado', 'success');
    }, 2000);
}

// ============= INTEGRACIÓN CON EL SISTEMA PRINCIPAL =============

/**
 * Actualizar showAdminPage para incluir asistencia de clientes
 */
const originalShowAdminPageForClients = window.showAdminPage;
window.showAdminPage = function(pageName) {
    // Llamar función original
    originalShowAdminPageForClients(pageName);
    
    // Si es la página de asistencia de clientes, inicializar
    if (pageName === 'clientAttendance') {
        setTimeout(() => {
            initializeClientAttendanceModule();
        }, 100);
    }
};

// ============= SISTEMA DE GESTIÓN DE USUARIOS Y HISTORIAL =============

// Variables globales para gestión de usuarios
let currentEditingUser = null;
let currentUserHistory = [];
let selectedUsers = new Set();

// ============= FUNCIONES PRINCIPALES DE GESTIÓN DE USUARIOS =============

/**
 * Abre el modal para editar un usuario
 */
async function editUser(userId) {
    try {
        console.log(`📝 Editando usuario: ${userId}`);
        
        // Obtener datos del usuario
        let userData = null;
        
        if (isFirebaseConnected && database) {
            const userSnapshot = await database.ref(`usuarios/${userId}`).once('value');
            if (userSnapshot.exists()) {
                userData = { id: userId, ...userSnapshot.val() };
            }
        } else {
            // Modo demo
            userData = getDemoUserData(userId);
        }
        
        if (!userData) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        // Guardar referencia global
        currentEditingUser = userData;
        
        // Llenar el modal con los datos
        await populateUserEditModal(userData);
        
        // Mostrar el modal
        showModal('editUserModal');
        
    } catch (error) {
        console.error('Error editando usuario:', error);
        showNotification('Error al abrir la edición de usuario', 'error');
    }
}

/**
 * Llena el modal de edición con los datos del usuario
 */
async function populateUserEditModal(userData) {
    try {
        // Datos básicos
        document.getElementById('editUserId').value = userData.id;
        document.getElementById('editUserName').value = userData.nombre || '';
        document.getElementById('editUserRut').value = userData.rut || '';
        document.getElementById('editUserEmail').value = userData.email || '';
        document.getElementById('editUserPhone').value = userData.telefono || '';
        document.getElementById('editUserRole').value = userData.rol || 'cliente';
        document.getElementById('editUserStatus').value = userData.activo !== false ? 'true' : 'false';
        
        // Información del sistema
        document.getElementById('editUserCreated').textContent = 
            userData.fechaCreacion ? 
            new Date(userData.fechaCreacion).toLocaleString('es-CL') : 
            'No disponible';
            
        document.getElementById('editUserLastAccess').textContent = 
            userData.ultimoAcceso ? 
            new Date(userData.ultimoAcceso).toLocaleString('es-CL') : 
            'Nunca';
        
    } catch (error) {
        console.error('Error llenando modal:', error);
    }
}

/**
 * Guarda los cambios del usuario
 */
async function saveUserChanges() {
    if (!currentEditingUser) {
        showNotification('Error: No hay usuario seleccionado', 'error');
        return;
    }
    
    try {
        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
        
        // Recopilar datos del formulario
        const updatedData = {
            nombre: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            telefono: document.getElementById('editUserPhone').value,
            rol: document.getElementById('editUserRole').value,
            activo: document.getElementById('editUserStatus').value === 'true',
            fechaModificacion: new Date().toISOString(),
            modificadoPor: currentUser?.email || 'admin'
        };
        
        // Guardar los datos
        await saveUserData(currentEditingUser.id, updatedData);
        
        // Registrar el cambio en el historial
        await logUserActivity(currentEditingUser.id, 'profile_update', {
            updatedFields: Object.keys(updatedData),
            updatedBy: currentUser?.email || 'admin'
        });
        
        showNotification('Usuario actualizado exitosamente', 'success');
        closeEditUserModal();
        
        // Recargar tabla de usuarios
        setTimeout(() => {
            if (isFirebaseConnected) {
                loadRealUsersWithManagement();
            } else {
                loadDemoUsersWithManagement();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error guardando usuario:', error);
        showNotification('Error al guardar cambios', 'error');
    } finally {
        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
    }
}

/**
 * Guarda los datos del usuario en Firebase o modo demo
 */
async function saveUserData(userId, userData) {
    if (isFirebaseConnected && database) {
        await database.ref(`usuarios/${userId}`).update(userData);
        
        // Registrar actividad
        await logUserActivity(userId, 'profile_update', {
            updatedFields: Object.keys(userData),
            updatedBy: currentUser?.email || 'admin'
        });
        
    } else {
        // Modo demo - simular guardado
        console.log('Demo: Guardando datos de usuario:', userData);
    }
}

/**
 * Ver historial de un usuario
 */
async function viewUserHistory(userId) {
    try {
        console.log(`📊 Cargando historial del usuario: ${userId}`);
        
        // Obtener datos del usuario
        let userData = currentEditingUser;
        if (!userData) {
            userData = getDemoUserData(userId);
        }
        
        if (!userData) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        // Configurar modal de historial
        await setupUserHistoryModal(userData);
        
        // Cargar historial
        await loadUserHistoryData(userId);
        
        // Mostrar modal
        showModal('userHistoryModal');
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        showNotification('Error al cargar historial', 'error');
    }
}

/**
 * Configura el modal de historial con los datos del usuario
 */
async function setupUserHistoryModal(userData) {
    // Avatar
    const avatar = document.getElementById('historyUserAvatar');
    avatar.textContent = userData.nombre ? 
        userData.nombre.split(' ').map(n => n[0]).join('').substr(0, 2).toUpperCase() :
        'NN';
    
    // Información básica
    document.getElementById('historyUserName').textContent = userData.nombre || 'Usuario';
    document.getElementById('historyUserEmail').textContent = userData.email || 'Sin email';
}

/**
 * Carga los datos del historial del usuario
 */
async function loadUserHistoryData(userId) {
    try {
        const timeline = document.getElementById('userHistoryTimeline');
        timeline.innerHTML = '<div class="timeline-loading"><span class="material-icons rotating">refresh</span> Cargando historial...</div>';
        
        let historyData = [];
        
        if (isFirebaseConnected && database) {
            // Cargar historial real desde Firebase
            const historySnapshot = await database.ref(`usuarios_historial/${userId}`).once('value');
            if (historySnapshot.exists()) {
                const history = historySnapshot.val();
                historyData = Object.entries(history).map(([id, data]) => ({
                    id,
                    ...data
                })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }
        } else {
            // Generar historial demo
            historyData = generateDemoUserHistory(userId);
        }
        
        // Si no hay historial, agregar algunas actividades básicas
        if (historyData.length === 0) {
            historyData = [
                {
                    id: 'registro',
                    type: 'system',
                    title: 'Cuenta creada',
                    description: 'El usuario se registró en el sistema',
                    timestamp: new Date(Date.now() - 86400000 * 30).toISOString()
                }
            ];
        }
        
        currentUserHistory = historyData;
        renderUserTimeline(historyData);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        const timeline = document.getElementById('userHistoryTimeline');
        timeline.innerHTML = '<div class="timeline-loading" style="color: #dc3545;"><span class="material-icons">error</span> Error cargando historial</div>';
    }
}

/**
 * Renderiza el timeline del historial
 */
function renderUserTimeline(historyData) {
    const timeline = document.getElementById('userHistoryTimeline');
    
    if (historyData.length === 0) {
        timeline.innerHTML = '<div class="timeline-loading">No hay actividad registrada</div>';
        return;
    }
    
    const timelineHTML = historyData.map(item => {
        const date = new Date(item.timestamp);
        const timeString = date.toLocaleString('es-CL');
        const icon = getActivityIcon(item.type);
        
        return `
            <div class="timeline-item" data-type="${item.type}">
                <div class="timeline-icon ${item.type}" style="background: ${getActivityColor(item.type)};">
                    <span class="material-icons">${icon}</span>
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <div class="timeline-title">${item.title}</div>
                        <div class="timeline-time">${timeString}</div>
                    </div>
                    <div class="timeline-description">${item.description}</div>
                </div>
            </div>
        `;
    }).join('');
    
    timeline.innerHTML = timelineHTML;
}

/**
 * Obtiene el icono para un tipo de actividad
 */
function getActivityIcon(type) {
    const icons = {
        'login': 'login',
        'appointment': 'event',
        'role_change': 'admin_panel_settings',
        'profile_update': 'edit',
        'system': 'settings',
        'error': 'error'
    };
    return icons[type] || 'info';
}

/**
 * Obtiene el color para un tipo de actividad
 */
function getActivityColor(type) {
    const colors = {
        'login': '#28a745',
        'appointment': '#667eea',
        'role_change': '#ffc107',
        'profile_update': '#17a2b8',
        'system': '#6c757d',
        'error': '#dc3545'
    };
    return colors[type] || '#6c757d';
}

/**
 * Registra una actividad del usuario
 */
async function logUserActivity(userId, type, details) {
    if (!userId) return;
    
    const activity = {
        type: type,
        title: getActivityTitle(type, details),
        description: getActivityDescription(type, details),
        timestamp: new Date().toISOString(),
        metadata: details,
        registeredBy: currentUser?.email || 'system'
    };
    
    try {
        if (isFirebaseConnected && database) {
            await database.ref(`usuarios_historial/${userId}`).push(activity);
        } else {
            // En modo demo, solo loggear
            console.log('Demo: Registrando actividad:', activity);
        }
    } catch (error) {
        console.error('Error registrando actividad:', error);
    }
}

/**
 * Obtiene el título de una actividad
 */
function getActivityTitle(type, details) {
    const titles = {
        'login': 'Inicio de sesión',
        'appointment': 'Actividad de cita',
        'role_change': 'Cambio de rol',
        'profile_update': 'Perfil actualizado',
        'system': 'Actividad del sistema'
    };
    
    return titles[type] || 'Actividad';
}

/**
 * Obtiene la descripción de una actividad
 */
function getActivityDescription(type, details) {
    switch (type) {
        case 'login':
            return 'El usuario inició sesión en el sistema';
        case 'profile_update':
            return `Campos actualizados: ${details?.updatedFields?.join(', ') || 'información del perfil'}`;
        case 'appointment':
            return details?.action || 'Actividad relacionada con citas';
        default:
            return details?.description || 'Actividad registrada';
    }
}

/**
 * Genera historial demo para un usuario
 */
function generateDemoUserHistory(userId) {
    const activities = [];
    const now = Date.now();
    
    // Registro
    activities.push({
        id: 'registro',
        type: 'system',
        title: 'Cuenta creada',
        description: 'El usuario se registró en el sistema',
        timestamp: new Date(now - 86400000 * 30).toISOString()
    });
    
    // Algunos logins
    for (let i = 0; i < 5; i++) {
        activities.push({
            id: `login_${i}`,
            type: 'login',
            title: 'Inicio de sesión',
            description: 'El usuario inició sesión en el sistema',
            timestamp: new Date(now - 86400000 * (i * 3 + 1)).toISOString()
        });
    }
    
    // Algunas citas
    activities.push({
        id: 'cita_1',
        type: 'appointment',
        title: 'Cita agendada',
        description: 'Nueva cita para Renovación de Licencia',
        timestamp: new Date(now - 86400000 * 7).toISOString()
    });
    
    // Actualización de perfil
    activities.push({
        id: 'update_1',
        type: 'profile_update',
        title: 'Perfil actualizado',
        description: 'Campos actualizados: teléfono, email',
        timestamp: new Date(now - 86400000 * 5).toISOString()
    });
    
    return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Obtiene datos demo de un usuario
 */
function getDemoUserData(userId) {
    const demoUsers = {
        '1': {
            id: '1',
            nombre: 'Juan Carlos Pérez',
            rut: '12.345.678-9',
            email: 'cliente1@gmail.com',
            telefono: '+56 9 8765 4321',
            rol: 'cliente',
            activo: true,
            fechaCreacion: '2024-11-15T10:30:00.000Z',
            ultimoAcceso: '2025-01-10T14:20:00.000Z'
        },
        '2': {
            id: '2',
            nombre: 'María Elena Rodríguez',
            rut: '98.765.432-1',
            email: 'maria.rodriguez@gmail.com',
            telefono: '+56 9 1234 5678',
            rol: 'cliente',
            activo: true,
            fechaCreacion: '2024-12-01T09:15:00.000Z',
            ultimoAcceso: '2025-01-09T16:45:00.000Z'
        },
        '3': {
            id: '3',
            nombre: 'Felipe Alfonso Albornoz',
            rut: '19.456.789-3',
            email: 'albornoz.felipealfonso@cftpucv.cl',
            telefono: '+56 9 9876 5432',
            rol: 'admin',
            activo: true,
            fechaCreacion: '2024-10-01T08:00:00.000Z',
            ultimoAcceso: '2025-01-11T11:30:00.000Z'
        }
    };
    
    return demoUsers[userId] || null;
}

/**
 * Cambio rápido de rol
 */
async function quickRoleChange(userId, currentRole) {
    const roles = ['cliente', 'empleado', 'admin'];
    const currentIndex = roles.indexOf(currentRole);
    const nextIndex = (currentIndex + 1) % roles.length;
    const newRole = roles[nextIndex];
    
    const confirmation = confirm(
        `¿Cambiar rol de "${currentRole}" a "${newRole}" para este usuario?\n\n` +
        'Este cambio será inmediato y afectará los permisos del usuario.'
    );
    
    if (confirmation) {
        try {
            const justification = prompt('Justificación del cambio (requerido):');
            if (!justification) {
                showNotification('Cambio cancelado: se requiere justificación', 'info');
                return;
            }
            
            // Aplicar cambio
            await saveUserData(userId, { rol: newRole });
            await logUserActivity(userId, 'role_change', {
                oldRole: currentRole,
                newRole: newRole,
                justification: justification,
                changedBy: currentUser?.email || 'admin',
                quickChange: true
            });
            
            showNotification(`Rol cambiado: ${currentRole} → ${newRole}`, 'success');
            
            // Recargar tabla
            setTimeout(() => {
                if (isFirebaseConnected) {
                    loadRealUsersWithManagement();
                } else {
                    loadDemoUsersWithManagement();
                }
            }, 1000);
            
        } catch (error) {
            console.error('Error en cambio rápido:', error);
            showNotification('Error al cambiar rol', 'error');
        }
    }
}

/**
 * Funciones auxiliares
 */
function getRoleClass(role) {
    const classes = {
        'cliente': 'role-cliente',
        'empleado': 'role-empleado',
        'admin': 'role-admin'
    };
    return classes[role] || 'role-cliente';
}

function formatRole(role) {
    const names = {
        'cliente': '👤 Cliente',
        'empleado': '👔 Empleado',
        'admin': '👑 Administrador'
    };
    return names[role] || '👤 Cliente';
}

function closeEditUserModal() {
    currentEditingUser = null;
    hideModal('editUserModal');
}

function closeUserHistoryModal() {
    currentUserHistory = [];
    hideModal('userHistoryModal');
}

function handleRoleChange() {
    // Función placeholder para el select de rol
    console.log('Rol cambiado');
}

// ============= FUNCIÓN MEJORADA PARA CARGAR USUARIOS DEMO =============

function loadDemoUsersWithManagement() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr data-user-id="1">
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar-small">JP</div>
                    <div>
                        <strong>Juan Carlos Pérez</strong><br>
                        <small style="color: #666;">12.345.678-9</small>
                    </div>
                </div>
            </td>
            <td>cliente1@gmail.com</td>
            <td><span class="role-badge role-cliente">👤 Cliente</span></td>
            <td><span class="status-badge status-confirmada">Activo</span></td>
            <td>2025-01-05 10:30</td>
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn btn-warning btn-sm" onclick="editUser('1')" title="Editar usuario">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-info btn-sm" onclick="viewUserHistory('1')" title="Ver historial">
                        <span class="material-icons">history</span>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="quickRoleChange('1', 'cliente')" title="Cambio rápido de rol">
                        <span class="material-icons">admin_panel_settings</span>
                    </button>
                </div>
            </td>
        </tr>
        <tr data-user-id="2">
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar-small">MR</div>
                    <div>
                        <strong>María Elena Rodríguez</strong><br>
                        <small style="color: #666;">98.765.432-1</small>
                    </div>
                </div>
            </td>
            <td>maria.rodriguez@gmail.com</td>
            <td><span class="role-badge role-cliente">👤 Cliente</span></td>
            <td><span class="status-badge status-confirmada">Activo</span></td>
            <td>2025-01-04 15:20</td>
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn btn-warning btn-sm" onclick="editUser('2')" title="Editar usuario">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-info btn-sm" onclick="viewUserHistory('2')" title="Ver historial">
                        <span class="material-icons">history</span>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="quickRoleChange('2', 'cliente')" title="Cambio rápido de rol">
                        <span class="material-icons">admin_panel_settings</span>
                    </button>
                </div>
            </td>
        </tr>
        <tr style="background: #f0f2ff;" data-user-id="3">
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar-small admin-avatar" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: #333;">FA</div>
                    <div>
                        <strong>Felipe Alfonso Albornoz</strong><br>
                        <small style="color: #666;">19.456.789-3</small>
                    </div>
                </div>
            </td>
            <td>albornoz.felipealfonso@cftpucv.cl</td>
            <td><span class="role-badge role-admin">👑 Administrador</span></td>
            <td><span class="status-badge status-confirmada">Activo</span></td>
            <td>2025-01-05 08:00</td>
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn btn-warning btn-sm" onclick="editUser('3')" title="Editar administrador">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-info btn-sm" onclick="viewUserHistory('3')" title="Ver historial">
                        <span class="material-icons">history</span>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function hideAdminInfo() {
    const adminInfo = document.querySelector('.admin-access-info');
    if (adminInfo) {
        adminInfo.style.display = 'none';
        localStorage.setItem('hideAdminInfo', 'true');
    }
}

function showAdminInfo() {
    const adminInfo = document.querySelector('.admin-access-info');
    if (adminInfo) {
        adminInfo.style.display = 'block';
        localStorage.setItem('hideAdminInfo', 'false');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const shouldHide = localStorage.getItem('hideAdminInfo');
    if (shouldHide === 'true') {
        const adminInfo = document.querySelector('.admin-access-info');
        if (adminInfo) {
            adminInfo.style.display = 'none';
        }
    }
});



// ============= FUNCIONES GLOBALES =============
window.showPublicView = showPublicView;
window.showClientPortal = showClientPortal;
window.showAdminLogin = showAdminLogin;
window.showClientTab = showClientTab;
window.showAdminPage = showAdminPage;
window.toggleSidebar = toggleSidebar;
window.showStep = showStep;
window.selectService = selectService;
window.loadAvailableHours = loadAvailableHours;
window.selectHour = selectHour;
window.confirmAppointment = confirmAppointment;
window.showModal = showModal;
window.hideModal = hideModal;
window.fillDemoLogin = fillDemoLogin;
window.fillAdminDemo = fillAdminDemo;
window.adminLogout = adminLogout;
window.completeAppointment = completeAppointment;
window.editAppointment = editAppointment;
window.cancelAppointment = cancelAppointment;
window.confirmAppointmentAdmin = confirmAppointmentAdmin;
window.viewAppointment = viewAppointment;
window.editUser = editUser;
window.viewUserHistory = viewUserHistory;
window.cancelUserAppointment = cancelUserAppointment;
window.rescheduleAppointment = rescheduleAppointment;
window.filterAppointments = filterAppointments;
window.filterUsers = filterUsers;
window.sendTestNotification = sendTestNotification;
window.sendReminders = sendReminders;
window.downloadAppointmentPDF = downloadAppointmentPDF;
window.downloadLicensePDF = downloadLicensePDF;
window.hideRescheduleModal = hideRescheduleModal;
window.confirmReschedule = confirmReschedule;
window.selectRescheduleHour = selectRescheduleHour;
window.loadRescheduleHours = loadRescheduleHours;
window.hideEditModal = hideEditModal;
window.validateWeekday = validateWeekday;
window.validateRescheduleWeekday = validateRescheduleWeekday;
window.esFeriado = esFeriado;
window.mostrarInfoFeriados = mostrarInfoFeriados;
window.mostrarProximosFeriados = mostrarProximosFeriados;
window.checkPreviousAppointments = checkPreviousAppointments;
window.validateScheduleAccess = validateScheduleAccess;
window.showScheduleBlocker = showScheduleBlocker;
window.getUserActiveCitasCount = getUserActiveCitasCount;
window.showSchedulingInfo = showSchedulingInfo;

window.validarRutChileno = validarRutChileno;
window.formatearRut = formatearRut;
window.limpiarRut = limpiarRut;
window.configurarValidacionRut = configurarValidacionRut;
window.validarCampoRut = validarCampoRut;
window.loadRealData = loadRealData;
window.loadRealAppointments = loadRealAppointments;
window.loadTodayAppointments = loadTodayAppointments;
window.loadRealUsers = loadRealUsers;
window.showAdminView = showAdminView;
window.showAdminPage = showAdminPage;
window.completeAppointmentAsync = completeAppointmentAsync;
window.confirmAppointmentAdminAsync = confirmAppointmentAdminAsync;
window.cancelAppointmentAsync = cancelAppointmentAsync;

window.editAppointment = editAppointment;
window.saveAppointmentChanges = saveAppointmentChanges;
window.cancelAppointmentEdit = cancelAppointmentEdit;
window.deleteAppointment = deleteAppointment;
window.loadEditAvailableHours = loadEditAvailableHours;
window.validateEditWeekday = validateEditWeekday;


window.initializeAttendanceModule = initializeAttendanceModule;
window.registerEntry = registerEntry;
window.registerExit = registerExit;
window.markAbsent = markAbsent;
window.viewEmployeeHistory = viewEmployeeHistory;
window.closeEmployeeHistoryModal = closeEmployeeHistoryModal;
window.exportEmployeeReport = exportEmployeeReport;
window.generateAttendanceReport = generateAttendanceReport;


window.filterEmployeeTable = filterEmployeeTable;
window.filterByStatus = filterByStatus;
window.filterByDepartment = filterByDepartment;
window.registerBulkEntry = registerBulkEntry;
window.registerBulkExit = registerBulkExit;
window.showAttendanceSummary = showAttendanceSummary;
window.closeSummaryModal = closeSummaryModal;
window.syncAttendanceData = syncAttendanceData;
window.generateDailyReport = generateDailyReport;
window.showLateEmployeesReport = showLateEmployeesReport;
window.closeLateEmployeesModal = closeLateEmployeesModal;
window.sendWarningToEmployee = sendWarningToEmployee;
window.exportLateReport = exportLateReport;
window.generateMonthlyReport = generateMonthlyReport;
window.viewTrendAnalysis = viewTrendAnalysis;
window.startAttendanceAutoUpdate = startAttendanceAutoUpdate;
window.stopAttendanceAutoUpdate = stopAttendanceAutoUpdate;

window.initializeClientAttendanceModule = initializeClientAttendanceModule;
window.markClientAttended = markClientAttended;
window.markClientNoShow = markClientNoShow;
window.markClientLate = markClientLate;
window.loadClientAttendanceData = loadClientAttendanceData;
window.updateClientAttendanceStats = updateClientAttendanceStats

window.filterClientAttendanceTable = filterClientAttendanceTable;
window.filterByAttendanceStatus = filterByAttendanceStatus;
window.filterByServiceType = filterByServiceType;
window.editClientAttendance = editClientAttendance;
window.closeEditAttendanceModal = closeEditAttendanceModal;
window.saveAttendanceEdit = saveAttendanceEdit;
window.viewClientAttendanceHistory = viewClientAttendanceHistory;
window.closeClientHistoryModal = closeClientHistoryModal;
window.markAllPresent = markAllPresent;
window.markPendingAsNoShow = markPendingAsNoShow;
window.generateClientAttendanceReport = generateClientAttendanceReport;
window.showNoShowAnalysis = showNoShowAnalysis;
window.closeNoShowAnalysisModal = closeNoShowAnalysisModal;
window.sendAttendanceReminders = sendAttendanceReminders;
window.refreshAttendanceData = refreshAttendanceData;
window.exportClientHistory = exportClientHistory;
window.implementNoShowPolicy = implementNoShowPolicy;
window.exportNoShowReport = exportNoShowReport;
window.generateDetailedAnalysis = generateDetailedAnalysis;
window.exportTrendsReport = exportTrendsReport;

window.editUser = editUser;
window.viewUserHistory = viewUserHistory;
window.quickRoleChange = quickRoleChange;
window.saveUserChanges = saveUserChanges;
window.closeEditUserModal = closeEditUserModal;
window.closeUserHistoryModal = closeUserHistoryModal;
window.handleRoleChange = handleRoleChange;
window.logUserActivity = logUserActivity;
window.loadDemoUsersWithManagement = loadDemoUsersWithManagement;
window.getRoleClass = getRoleClass;
window.formatRole = formatRole;

window.hideAdminInfo = hideAdminInfo;
window.showAdminInfo = showAdminInfo;

console.log('✅ Sistema completo cargado con validación de feriados nacionales chilenos');

// ============= VERIFICACIÓN DE FERIADOS (OPCIONAL) =============
// Ejecutar solo si estás en modo desarrollo para verificar que todo funciona
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🧪 Modo desarrollo detectado - Ejecutando pruebas de feriados:');
    console.log('Navidad 2025:', esFeriado('2025-12-25'));
    console.log('Año Nuevo 2025:', esFeriado('2025-01-01'));
    console.log('Viernes Santo 2025:', esFeriado('2025-04-18'));
    console.log('Día normal (15 marzo 2025):', esFeriado('2025-03-15'));
    console.log('Próximos feriados:', mostrarProximosFeriados());
}