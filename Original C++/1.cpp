#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iostream>
#include <thread>
#include <vector>
#include <chrono>
#include <tchar.h>

#pragma comment(lib, "Ws2_32.lib")
#pragma comment(lib, "Gdi32.lib")

#define SERVER_PORT 23456

bool SendBitmapData(SOCKET clientSocket, const BYTE *data, int dataSize)
{
    int bytesSent = send(clientSocket, reinterpret_cast<const char *>(data), dataSize, 0);
    return bytesSent == dataSize;
}

void CaptureScreen(const char *filePath, SOCKET clientSocket)
{
    HDESK hInputDesktop = OpenInputDesktop(0, FALSE, GENERIC_ALL);
    if (!hInputDesktop)
    {
        std::cerr << "OpenInputDesktop failed: " << GetLastError() << std::endl;
        return;
    }

    if (!SetThreadDesktop(hInputDesktop))
    {
        std::cerr << "SetThreadDesktop failed: " << GetLastError() << std::endl;
        CloseDesktop(hInputDesktop);
        return;
    }

    HDC hScreenDC = GetDC(NULL);
    if (!hScreenDC)
    {
        std::cerr << "GetDC failed: " << GetLastError() << std::endl;
        CloseDesktop(hInputDesktop);
        return;
    }

    HDC hMemoryDC = CreateCompatibleDC(hScreenDC);
    if (!hMemoryDC)
    {
        std::cerr << "CreateCompatibleDC failed: " << GetLastError() << std::endl;
        ReleaseDC(NULL, hScreenDC);
        CloseDesktop(hInputDesktop);
        return;
    }

    int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    int screenHeight = GetSystemMetrics(SM_CYSCREEN);

    HBITMAP hBitmap = CreateCompatibleBitmap(hScreenDC, screenWidth, screenHeight);
    if (!hBitmap)
    {
        std::cerr << "CreateCompatibleBitmap failed: " << GetLastError() << std::endl;
        DeleteDC(hMemoryDC);
        ReleaseDC(NULL, hScreenDC);
        CloseDesktop(hInputDesktop);
        return;
    }

    HGDIOBJ hOldBitmap = SelectObject(hMemoryDC, hBitmap);

    if (!BitBlt(hMemoryDC, 0, 0, screenWidth, screenHeight, hScreenDC, 0, 0, SRCCOPY))
    {
        std::cerr << "BitBlt failed: " << GetLastError() << std::endl;
        SelectObject(hMemoryDC, hOldBitmap);
        DeleteObject(hBitmap);
        DeleteDC(hMemoryDC);
        ReleaseDC(NULL, hScreenDC);
        CloseDesktop(hInputDesktop);
        return;
    }

    // Capture the mouse cursor
    CURSORINFO cursorInfo = {0};
    cursorInfo.cbSize = sizeof(cursorInfo);
    if (GetCursorInfo(&cursorInfo))
    {
        if (cursorInfo.flags == CURSOR_SHOWING)
        {
            ICONINFO iconInfo = {0};
            if (GetIconInfo(cursorInfo.hCursor, &iconInfo))
            {
                int cursorX = cursorInfo.ptScreenPos.x - iconInfo.xHotspot;
                int cursorY = cursorInfo.ptScreenPos.y - iconInfo.yHotspot;
                DrawIcon(hMemoryDC, cursorX, cursorY, cursorInfo.hCursor);
                DeleteObject(iconInfo.hbmMask);
                DeleteObject(iconInfo.hbmColor);
            }
        }
    }

    BITMAPINFOHEADER bi = {0};
    bi.biSize = sizeof(BITMAPINFOHEADER);
    bi.biWidth = screenWidth;
    bi.biHeight = -screenHeight; // Negative to indicate a top-down DIB
    bi.biPlanes = 1;
    bi.biBitCount = 32;
    bi.biCompression = BI_RGB;

    int dataSize = ((screenWidth * bi.biBitCount + 31) / 32) * 4 * screenHeight;
    BYTE *pData = new BYTE[dataSize];

    if (!GetDIBits(hMemoryDC, hBitmap, 0, screenHeight, pData, (BITMAPINFO *)&bi, DIB_RGB_COLORS))
    {
        std::cerr << "GetDIBits failed: " << GetLastError() << std::endl;
        delete[] pData;
        SelectObject(hMemoryDC, hOldBitmap);
        DeleteObject(hBitmap);
        DeleteDC(hMemoryDC);
        ReleaseDC(NULL, hScreenDC);
        CloseDesktop(hInputDesktop);
        return;
    }

    BITMAPFILEHEADER bf = {0};
    bf.bfType = 0x4D42; // 'BM'
    bf.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
    bf.bfSize = bf.bfOffBits + dataSize;

    send(clientSocket, reinterpret_cast<const char *>(&bf), sizeof(bf), 0);
    send(clientSocket, reinterpret_cast<const char *>(&bi), sizeof(bi), 0);
    SendBitmapData(clientSocket, pData, dataSize);

    delete[] pData;
    SelectObject(hMemoryDC, hOldBitmap);
    DeleteObject(hBitmap);
    DeleteDC(hMemoryDC);
    ReleaseDC(NULL, hScreenDC);
    CloseDesktop(hInputDesktop);
}

int captureCount = 0;
void HandleClient(SOCKET clientSocket)
{
    while (true)
    {
        std::string filePath = "C:\\screenshot\\screenshot.bmp";
        CaptureScreen(filePath.c_str(), clientSocket); // Convert std::string to const char*
        std::this_thread::sleep_for(std::chrono::milliseconds(33));
        captureCount++;
    }
    closesocket(clientSocket);
}

int main()
{
    // Set DPI awareness
    SetProcessDPIAware();

    WSADATA wsaData;
    SOCKET serverSocket = INVALID_SOCKET, clientSocket = INVALID_SOCKET;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
    {
        std::cerr << "WSAStartup failed" << std::endl;
        return 1;
    }

    serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket == INVALID_SOCKET)
    {
        std::cerr << "Socket creation failed" << std::endl;
        WSACleanup();
        return 1;
    }

    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(SERVER_PORT);
    serverAddr.sin_addr.s_addr = INADDR_ANY;

    if (bind(serverSocket, (sockaddr *)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR)
    {
        std::cerr << "Bind failed with error: " << WSAGetLastError() << std::endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR)
    {
        std::cerr << "Listen failed with error: " << WSAGetLastError() << std::endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    while (true)
    {
        clientSocket = accept(serverSocket, NULL, NULL);
        if (clientSocket == INVALID_SOCKET)
        {
            std::cerr << "Accept failed with error: " << WSAGetLastError() << std::endl;
            continue;
        }
        std::thread clientThread(HandleClient, clientSocket);
        clientThread.detach(); // Detach the thread to handle multiple clients
    }

    closesocket(serverSocket);
    WSACleanup();
    return 0;
}
