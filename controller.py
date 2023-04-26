import tornado.ioloop
import tornado.web
import tornado.websocket

from threading import Thread

import pygame
import io
import base64

pygame.init()
window = pygame.display.set_mode((512, 512), pygame.RESIZABLE)
clock = pygame.time.Clock()
# icon = pygame.image.load('icon.png')
# pygame.display.set_icon(icon)
# rect = pygame.Rect(0, 0, 20, 20)
# rect.center = window.get_rect().center
# vel = 5

class WebSocketHandler(tornado.websocket.WebSocketHandler):

    clients = set()

    def open(self):
        print("open")
        WebSocketHandler.clients.add(self)

    def on_close(self):
        WebSocketHandler.clients.remove(self)

    @classmethod
    def send_message(cls, message: str):
        # print(f"message {message} to {len(cls.clients)}")
        for client in cls.clients:
            client.write_message(message)

    def on_message(self, message):
        # print("received", message)
        str = message[message.find(",")+1:]
        str = io.BytesIO(base64.b64decode(str))
        img = pygame.image.load(str)
        window.fill(0)
        window.blit(img, (0, 0))
        pygame.display.update()


    def check_origin(self, origin):
        return True

def main():
    app = tornado.web.Application([("/websocket", WebSocketHandler)])
    app.listen(8000)

    io_loop = tornado.ioloop.IOLoop.current()

    def send():
        WebSocketHandler.send_message("hello!")
        # print("send hello!")

    # periodic_callback = tornado.ioloop.PeriodicCallback(send, 500)
    # periodic_callback.start()

    t = Thread(target=io_loop.start)
    t.daemon = True
    t.start()

    run = True
    while run:
        clock.tick(60)

        keys = pygame.key.get_pressed()
        send = {
            "left": keys[pygame.K_a],
            "right": keys[pygame.K_d],
            "up": keys[pygame.K_w],
            "down": keys[pygame.K_s],

            "g_left": keys[pygame.K_LEFT],
            "g_right": keys[pygame.K_RIGHT],
            "g_fw": keys[pygame.K_UP],
            "g_bw": keys[pygame.K_DOWN],
            "g_up": keys[pygame.K_COMMA],
            "g_down": keys[pygame.K_PERIOD],

            "g_yaw1": keys[pygame.K_y],
            "g_yaw2": keys[pygame.K_u],

            "g_pitch1": keys[pygame.K_p],
            "g_pitch2": keys[pygame.K_LEFTBRACKET],

            "g_roll1": keys[pygame.K_r],
            "g_roll2": keys[pygame.K_t],

            "gripper_toggle": False,
        }

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False
            if event.type == pygame.KEYDOWN:
                print(pygame.key.name(event.key))
                if event.key == pygame.K_ESCAPE:
                    run = False
                if event.key == pygame.K_g:
                    send["gripper_toggle"] = True

        # print("send", send)
        WebSocketHandler.send_message(send)

    pygame.quit()
    exit()

if __name__ == "__main__":
    main()
