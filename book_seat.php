<?php
header('Content-Type: application/json');
include 'db_connect.php';

// Get POSTed JSON
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$required = ['user_id', 'bus_id', 'seat_no', 'booking_date', 'route', 'status', 'passenger_name', 'passenger_email', 'payment'];
foreach ($required as $field) {
    if (empty($input[$field])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Missing $field"]);
        exit;
    }
}

$user_id = $input['user_id'];
$bus_id = $input['bus_id'];
$seat_no = $input['seat_no'];
$booking_date = $input['booking_date'];
$route = $input['route'];
$status = $input['status'];
$passenger_name = $input['passenger_name'];
$passenger_email = $input['passenger_email'];
$payment = $input['payment'];

// Insert booking into database
$stmt = $conn->prepare("INSERT INTO bookings (user_id, bus_id, seat_no, booking_date, route, status, passenger_name, passenger_email, payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("iisssssss", $user_id, $bus_id, $seat_no, $booking_date, $route, $status, $passenger_name, $passenger_email, $payment);

if ($stmt->execute()) {
    $bookingId = $conn->insert_id; // Get the real MySQL auto ID
    echo json_encode([
        'success' => true,
        'message' => 'Booking successful',
        'booking_id' => $bookingId
    ]);
}
 else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $stmt->error]);
}

$stmt->close();
$conn->close();
?>
