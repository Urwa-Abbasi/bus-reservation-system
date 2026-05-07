<?php
header("Content-Type: application/json");
include "db_connect.php";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $from = $_POST['from'] ?? '';
    $to = $_POST['to'] ?? '';

    if ($from && $to) {
        $stmt = $conn->prepare("
            SELECT id,
                   CONCAT(from_city, ' - ', to_city) AS name,
                   from_city,
                   to_city,
                   departure_time,
                   price
            FROM buses
            WHERE from_city = ? AND to_city = ?
        ");
        $stmt->bind_param("ss", $from, $to);
        $stmt->execute();
        $result = $stmt->get_result();

        $buses = [];
        while ($row = $result->fetch_assoc()) {
            $buses[] = $row;
        }

        echo json_encode($buses);
    } else {
        echo json_encode(["error" => "Missing parameters"]);
    }
} else {
    echo json_encode(["error" => "Invalid request method"]);
}

$conn->close();
?>
