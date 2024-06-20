import socket
import struct
import numpy as np
import cv2
from flask import Flask, render_template, Response
import base64
import os
import io
from PIL import Image

app = Flask(__name__)

def receive_bitmap_data(client_socket):
    while True:
        try:
            # Receive the bitmap file header
            bfh = client_socket.recv(14)
            if not bfh:
                print("No file header received")
                break

            # Parse the file header
            bf_type, bf_size, bf_reserved1, bf_reserved2, bf_off_bits = struct.unpack('<HIHHI', bfh)
            print(f"bf_type: {bf_type}, bf_size: {bf_size}, bf_off_bits: {bf_off_bits}")

            if bf_type != 0x4D42:  # 'BM' in little-endian
                print("Incorrect bitmap file header type")
                break

            # Receive the bitmap info header
            bih = client_socket.recv(40)
            if not bih:
                print("No info header received")
                break

            # Parse the info header
            (bi_size, bi_width, bi_height, bi_planes, bi_bit_count, bi_compression,
             bi_size_image, bi_x_pels_per_meter, bi_y_pels_per_meter, bi_clr_used, bi_clr_important) = struct.unpack('<IIIHHIIIIII', bih)
            print(f"bi_width: {bi_width}, bi_height: {bi_height}, bi_bit_count: {bi_bit_count}")

            if bi_bit_count != 32:
                print("Unexpected bit count")
                break

            # Calculate the remaining bytes to read
            remaining_bytes = bf_size - 14 - 40
            data = b''
            while remaining_bytes > 0:
                chunk = client_socket.recv(remaining_bytes)
                if not chunk:
                    print("Connection closed before receiving all data")
                    break
                data += chunk
                remaining_bytes -= len(chunk)
            
            if len(data) < bf_size - 14 - 40:
                print("Incomplete data received")
                break

            image_data = bfh + bih + data  # Combine headers and data
            image = Image.open(io.BytesIO(image_data))  # Use io.BytesIO for Image.open
            image.save('output_image.bmp')
            
            # Convert image to numpy array
            image_np = np.array(image)
            print(f"Image mode: {image.mode}, Shape: {image_np.shape}")

            # Convert color based on image mode
            if image.mode == 'RGBA':
                image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
            elif image.mode == 'RGB':
                image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            elif image.mode == 'L':
                image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2BGR)
            
            print(f"Image received with shape: {image_np.shape}")
            print(f"Sample pixel (0,0): {image_np[0,0]}")  # Print sample pixel value for debugging

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + cv2.imencode('.jpg', image_np)[1].tobytes() + b'\r\n')
        except Exception as e:
            print(f"Error receiving bitmap data: {e}")
            break

def connect_to_server():
    server_ip = '127.0.0.1'  # Change to the IP address of your C++ server if it's remote
    server_port = 23456

    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        client_socket.connect((server_ip, server_port))
        print(f"Connected to server at {server_ip}:{server_port}")
    except socket.error as e:
        print(f"Failed to connect to server at {server_ip}:{server_port} - {e}")
    return client_socket

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    client_socket = connect_to_server()
    print('123123');
    return Response(receive_bitmap_data(client_socket),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9876, debug=True)