/* ======= script.js (corrected + safe) ======= */

/* ---------- LOGIN / SIGNUP ---------- */
function toggleLoginTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = Array.from(document.querySelectorAll('.login-tab'));

    // remove active
    tabs.forEach(t => t.classList.remove('active'));

    // hide both
    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        const btn = tabs.find(b => b.dataset.tab === 'login');
        if (btn) btn.classList.add('active');
    } else {
        signupForm.classList.remove('hidden');
        const btn = tabs.find(b => b.dataset.tab === 'signup');
        if (btn) btn.classList.add('active');
    }

    // clear any messages
    const msg = document.getElementById('loginMessage');
    if (msg) msg.innerHTML = '';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        const res = await fetch('login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });

        // try parse json safely
        let data;
        const text = await res.text();
        try { data = JSON.parse(text); } catch (e) { data = { status: 'error', message: text }; }

        if (data.status === 'success') {
            // hide login container and show main app
            const loginPage = document.getElementById('loginPage');
            const mainApp = document.getElementById('mainApp');
            if (loginPage) loginPage.classList.add('hidden');
            if (mainApp) mainApp.classList.remove('hidden');

            document.getElementById('loggedInUser').textContent = data.name || 'User';

            // store logged in user for session (simple)
     localStorage.setItem('loggedInUser', JSON.stringify({ 
    id: data.id,      // <-- THIS IS THE IMPORTANT PART
    name: data.name, 
    email: data.email 
}));


            // optionally set travelDate min to today
            const travelDate = document.getElementById('travelDate');
            if (travelDate) travelDate.min = new Date().toISOString().split('T')[0];

        } else {
            alert('Login failed: ' + (data.status || data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Login error', err);
        alert('Login error: ' + err.message);
    }
}

async function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const msg = document.getElementById('loginMessage');

    try {
        const res = await fetch('signup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });

        // parse JSON or plain text
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { status: text.trim() }; }

        if (data.status === 'success' || data.status === 'success\n' || data.status === 'success\r\n') {
            alert('Signup successful! Please log in.');
            // reset form
            const form = document.getElementById('signupForm');
            if (form) form.reset();
            toggleLoginTab('login');
        } else if (data.status === 'missing_fields') {
            if (msg) { msg.innerHTML = '<div class="alert alert-error">Please fill all fields.</div>'; }
        } else {
            const errorMsg = data.message || data.status || 'Signup failed';
            if (msg) { msg.innerHTML = `<div class="alert alert-error">${errorMsg}</div>`; }
            else alert('Signup failed: ' + errorMsg);
        }
    } catch (err) {
        console.error('Signup error', err);
        alert('Signup error: ' + err.message);
    }
}

function logout() {
    localStorage.removeItem('loggedInUser');
    // hide main app, show login
    const mainApp = document.getElementById('mainApp');
    const loginPage = document.getElementById('loginPage');
    if (mainApp) mainApp.classList.add('hidden');
    if (loginPage) loginPage.classList.remove('hidden');

    // reset visible forms
    const lf = document.getElementById('loginForm');
    const sf = document.getElementById('signupForm');
    if (lf && typeof lf.reset === 'function') lf.reset();
    if (sf && typeof sf.reset === 'function') sf.reset();

    toggleLoginTab('login');
}

/* ---------- TAB NAV ---------- */
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    // activate the matching tab button (by data-tab or by text)
    const btn = Array.from(document.querySelectorAll('.tab')).find(b => b.dataset && b.dataset.tab === tabId) ||
                Array.from(document.querySelectorAll('.tab')).find(b => b.textContent.trim().toLowerCase().includes(tabId.toLowerCase()));
    if (btn) btn.classList.add('active');

    // If user clicked My Reservations, refresh list
    if (tabId === 'myReservations') loadMyReservations();
}

/* ---------- DUMMY BUSES & SEARCH ---------- */
/*const dummyBuses = [
    { id: 1, name: "Daewoo Express", from: "Karachi", to: "Lahore", price: 2500, time: "8:00 AM" },
    { id: 2, name: "Faisal Movers", from: "Lahore", to: "Islamabad", price: 1800, time: "10:30 AM" },
    { id: 3, name: "Skyways", from: "Islamabad", to: "Peshawar", price: 1200, time: "9:15 AM" },
    { id: 4, name: "Bilal Travels", from: "Multan", to: "Karachi", price: 2200, time: "6:00 PM" },
    { id: 5, name: "QConnect", from: "Lahore", to: "Multan", price: 1500, time: "2:00 PM" },
    { id: 6, name: "Waraich Express", from: "Karachi", to: "Islamabad", price: 2700, time: "7:00 AM" }
];*/

// Make sure these are global
window.selectedBus = null;

window.searchBuses = function() {
    const from = document.getElementById('fromCity').value;
    const to = document.getElementById('toCity').value;
    const date = document.getElementById('travelDate').value;
    const resultDiv = document.getElementById('busResults');

    resultDiv.innerHTML = "";

    if (!from || !to || !date) {
        resultDiv.innerHTML = "<p style='color:red;'>⚠️ Please fill all search fields.</p>";
        return;
    }

    fetch("get_buses.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ from, to })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            resultDiv.innerHTML = `<p style='color:red;'>${data.error}</p>`;
            return;
        }

        if (data.length === 0) {
            resultDiv.innerHTML = "<p>No buses found for this route.</p>";
            return;
        }

        data.forEach(bus => {
            const div = document.createElement('div');
            div.classList.add('bus-item');
            div.innerHTML = `
                <h3>${bus.name}</h3>
                <p><strong>Time:</strong> ${bus.departure_time}</p>
                <p><strong>Price:</strong> Rs. ${bus.price}</p>
                <button onclick="selectBusFromDB(${bus.id}, '${bus.name}', '${bus.from_city}', '${bus.to_city}', ${bus.price}, '${bus.departure_time}')">Select Bus</button>
            `;
            resultDiv.appendChild(div);
        });

        // Save selected search date to the div
        resultDiv.dataset.searchDate = date;
    })
    .catch(err => {
        console.error(err);
        resultDiv.innerHTML = "<p style='color:red;'>❌ Failed to fetch bus data.</p>";
    });
};

// Make this global too
window.selectBusFromDB = function(id, name, from, to, price, time) {
    selectedBus = { id, name, from, to, price, time };
    document.getElementById('selectedBusName').textContent = name;
    document.getElementById('selectedRoute').textContent = `${from} → ${to}`;
    document.getElementById('pricePerSeat').textContent = `Rs. ${price}`;
    document.getElementById('totalAmount').textContent = `Rs. 0`;

    showTab('booking');
    document.getElementById('seatSelection').classList.remove('hidden');
    generateSeats();
};



/* ---------- SEAT SELECTION ---------- */
let selectedBus = null;
let selectedSeats = [];
let selectedPayment = null;

function selectBus(busId) {
    selectedBus = dummyBuses.find(b => b.id === busId);
    if (!selectedBus) return alert('Bus not found');

    const selectedBusName = document.getElementById('selectedBusName');
    const selectedRoute = document.getElementById('selectedRoute');
    const pricePerSeat = document.getElementById('pricePerSeat');

    if (selectedBusName) selectedBusName.textContent = selectedBus.name;
    if (selectedRoute) selectedRoute.textContent = `${selectedBus.from} → ${selectedBus.to}`;
    if (pricePerSeat) pricePerSeat.textContent = `Rs. ${selectedBus.price}`;

    document.getElementById('totalAmount').textContent = `Rs. 0`;
    selectedSeats = [];
    selectedPayment = null;

    showTab('booking');
    const seatSelection = document.getElementById('seatSelection');
    if (seatSelection) seatSelection.classList.remove('hidden');

    generateSeats();
}

function generateSeats() {
    const grid = document.getElementById('seatGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 24; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.textContent = i;
        seat.addEventListener('click', () => toggleSeat(i, seat));
        grid.appendChild(seat);
    }
}

function toggleSeat(seatNum, seatDiv) {
    if (!seatDiv) return;
    if (selectedSeats.includes(seatNum)) {
        selectedSeats = selectedSeats.filter(s => s !== seatNum);
        seatDiv.classList.remove('selected');
    } else {
        selectedSeats.push(seatNum);
        seatDiv.classList.add('selected');
    }
    const sel = document.getElementById('selectedSeats');
    if (sel) sel.textContent = selectedSeats.join(', ') || 'None';
    const total = document.getElementById('totalAmount');
    if (total && selectedBus) total.textContent = `Rs. ${selectedSeats.length * selectedBus.price}`;
}

/* ---------- PAYMENT ---------- */
function selectPayment(method) {
    selectedPayment = method;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    // highlight clicked one by text match (safer than index)
    Array.from(document.querySelectorAll('.payment-method')).forEach(m => {
        if (m.textContent.toLowerCase().includes(method === 'cash' ? 'cash' : 'debit')) {
            m.classList.add('selected');
        }
    });
}

/* ---------- BOOKING & TICKET ---------- */
/* ---------- BOOKING & TICKET ---------- */
function confirmBooking() {
    if (!selectedBus) return alert('⚠️ No bus selected');
    if (!selectedSeats.length) return alert('⚠️ Please select a seat');
    if (!selectedPayment) return alert('⚠️ Please select a payment method');

    const date = document.getElementById('travelDate').value;
    if (!date) return alert('⚠️ Please select a travel date');

    // Get logged-in user info
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!currentUser || !currentUser.id) return alert('⚠️ You must be logged in to book');

    const total = selectedSeats.length * selectedBus.price;

    // Booking data to send to backend
    const bookingData = {
        user_id: currentUser.id,
        bus_id: selectedBus.id,
        seat_no: selectedSeats[0], // single seat
        booking_date: date,
        route: `${selectedBus.from} → ${selectedBus.to}`,
        status: 'booked',
        passenger_name: currentUser.name,
        passenger_email: currentUser.email,
        payment: selectedPayment
    };

    fetch('book_seat.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // ✅ USE REAL DATABASE ID INSTEAD OF FAKE ONE
            const booking = {
                id: data.booking_id, // REAL database ID from PHP
                user_id: currentUser.id,
                bus: selectedBus.name,
                route: bookingData.route,
                date: bookingData.booking_date,
                time: selectedBus.time,
                seat: selectedSeats[0],
                amount: total,
                payment: selectedPayment,
                passenger_name: currentUser.name,
                passenger_email: currentUser.email
            };
            alert('✅ Booking successful! Your Booking ID: ' + data.booking_id);
            showTicket(booking);
        } else {
            alert('❌ Booking failed: ' + data.error);
        }
    })
    .catch(err => {
        console.error(err);
        alert('❌ Something went wrong while booking.');
    });
}

function showTicket(booking) {
    // Hide booking section
    const bookingSection = document.querySelector('.booking-section'); // or the container div
    if (bookingSection) bookingSection.classList.add('hidden');

    // Show ticket display
    const ticketDisplay = document.getElementById('ticketDisplay');
    if (ticketDisplay) ticketDisplay.classList.remove('hidden');

    // Fill ticket info - NOW SHOWS REAL DATABASE ID
    document.getElementById('ticketBookingId').textContent = booking.id;
    document.getElementById('ticketName').textContent = booking.passenger_name || 'N/A';
    document.getElementById('ticketBusName').textContent = booking.bus;
    document.getElementById('ticketRoute').textContent = booking.route;
    document.getElementById('ticketDate').textContent = booking.date;
    document.getElementById('ticketTime').textContent = booking.time;
    document.getElementById('ticketSeats').textContent = booking.seat;
    document.getElementById('ticketAmount').textContent = booking.amount;
    document.getElementById('ticketPayment').textContent = booking.payment;
    document.getElementById('ticketEmail').textContent = booking.passenger_email || 'N/A';
}

// Optional: reset to booking form
function bookAnother() {
    document.getElementById('ticketDisplay').classList.add('hidden');
    const bookingSection = document.querySelector('.booking-section'); // or the container div
    if (bookingSection) bookingSection.classList.remove('hidden');
}


/* ---------- DOWNLOAD TICKET AS PDF ---------- */
async function downloadTicket() {
    const ticket = document.getElementById('eTicket');
    if (!ticket) return alert('No ticket to download');
    const { jsPDF } = window.jspdf;

    const canvas = await html2canvas(ticket, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    pdf.save(`Bus_Ticket_${Date.now()}.pdf`);
}

/* ---------- CANCEL / RESERVATIONS ---------- */
async function cancelTicket() {
    const bookingId = parseInt(document.getElementById('cancelBookingId').value.trim());
    const email = document.getElementById('cancelEmail').value.trim();
    const msg = document.getElementById('cancelMessage');

    if (!bookingId || !email) {
        msg.innerHTML = '<div style="color: red;">⚠️ Please enter both Booking ID and Email</div>';
        return;
    }

    try {
        const formData = new URLSearchParams();
        formData.append('booking_id', bookingId);
        formData.append('email', email);

        const response = await fetch('cancel_ticket.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.text();
        
        if (result.includes('✅')) {
            msg.innerHTML = `<div style="color: green;">${result}</div>`;
            document.getElementById('cancelBookingId').value = '';
            document.getElementById('cancelEmail').value = '';
        } else {
            msg.innerHTML = `<div style="color: red;">${result}</div>`;
        }
    } catch (error) {
        msg.innerHTML = '<div style="color: red;">❌ Network error</div>';
    }
}
function loadMyReservations() {
    const list = document.getElementById('reservationsList');
    if (!list) return;
    list.innerHTML = '';
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');

    const my = (currentUser && currentUser.email) ? reservations.filter(r => r.bookedBy === currentUser.email) : reservations;

    if (my.length === 0) {
        list.innerHTML = '<p>No reservations found.</p>';
        return;
    }

    my.forEach(r => {
        const div = document.createElement('div');
        div.className = 'reservation-card';
        div.innerHTML = `
            <div class="reservation-header">
                <h3>${r.bus}</h3>
                <span class="status-badge status-confirmed">CONFIRMED</span>
            </div>
            <div class="reservation-details">
                <div class="detail-item"><strong>Booking ID:</strong> ${r.id}</div>
                <div class="detail-item"><strong>Route:</strong> ${r.route}</div>
                <div class="detail-item"><strong>Date:</strong> ${r.date}</div>
                <div class="detail-item"><strong>Seats:</strong> ${r.seats}</div>
                <div class="detail-item"><strong>Amount:</strong> Rs. ${r.amount}</div>
            </div>
            <div class="action-buttons">
                <button onclick="viewTicket('${r.id}')">View Ticket</button>
                <button class="btn-danger" onclick="deleteReservation('${r.id}')">Delete Reservation</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function viewTicket(bookingId) {
    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    const booking = reservations.find(b => b.id === bookingId);
    if (booking) {
        showTicket(booking);
        showTab('booking');
    }
}

function deleteReservation(bookingId) {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    let reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    const idx = reservations.findIndex(b => b.id === bookingId);
    if (idx > -1) {
        const [removed] = reservations.splice(idx, 1);
        localStorage.setItem('reservations', JSON.stringify(reservations));
        alert(`Reservation deleted. Refund of Rs. ${removed.amount} will be processed.`);
        loadMyReservations();
    }
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
    // ensure login tab visible
    toggleLoginTab('login');

    // check logged in user from localStorage
    const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    if (user && user.name) {
        document.getElementById('loginPage')?.classList.add('hidden');
        document.getElementById('mainApp')?.classList.remove('hidden');
        document.getElementById('loggedInUser').textContent = user.name;
        document.getElementById('travelDate').min = new Date().toISOString().split('T')[0];
    }

    // attach reservation tab click (defensive)
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            // if the tab has a data-tab, pass it to showTab
            const dt = btn.dataset.tab;
            if (dt) showTab(dt);
        });
    });
});
