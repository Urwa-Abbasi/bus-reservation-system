<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $booking_id = $_POST['booking_id'] ?? '';
    $email = $_POST['email'] ?? '';

    if (!$booking_id || !$email) {
        echo "⚠️ Booking ID and Email are required.";
        exit;
    }

    // First, find the booking with matching booking_id and user email
    $stmt = $conn->prepare("
        SELECT b.id 
        FROM bookings b
        INNER JOIN users u ON b.user_id = u.id
        WHERE b.id = ? AND u.email = ?
    ");

    if (!$stmt) {
        die("Prepare failed: " . $conn->error);
    }

    $stmt->bind_param("is", $booking_id, $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        // Booking exists, delete it
        $delete = $conn->prepare("DELETE FROM bookings WHERE id = ?");
        if (!$delete) { die("Prepare failed: " . $conn->error); }
        $delete->bind_param("i", $booking_id);

        if ($delete->execute()) {
            echo "✅ Ticket cancelled successfully!";
        } else {
            echo "❌ Error cancelling ticket: " . $conn->error;
        }
    } else {
        echo "❌ Booking not found. Please check your Booking ID and Email.";
    }
}
?>

