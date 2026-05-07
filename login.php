<?php
/*header("Access-Control-Allow-Origin: http://localhost/project/bus%20reservation.html");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");*/
header('Content-Type: application/json'); // ADD THIS LINE
include 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';

    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

 if ($user = $result->fetch_assoc()) {
    if (password_verify($password, $user['password'])) {
        echo json_encode([
            "status" => "success",
            "id" => $user['id'],       // add this
            "name" => $user['name'],
            "email" => $user['email']  // add this too
        ]);
    } else {
        echo json_encode(["status" => "wrong_password"]);
    }
} else {
    echo json_encode(["status" => "no_user"]);
}
}
?>
