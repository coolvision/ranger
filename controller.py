import tornado.ioloop
import tornado.web
import tornado.websocket

from threading import Thread

import pygame

pygame.init()
window = pygame.display.set_mode((300, 300))
clock = pygame.time.Clock()
rect = pygame.Rect(0, 0, 20, 20)
rect.center = window.get_rect().center
vel = 5

class WebSocketHandler(tornado.websocket.WebSocketHandler):

    clients = set()

    def open(self):
        print("open")
        WebSocketHandler.clients.add(self)

    def on_close(self):
        WebSocketHandler.clients.remove(self)

    @classmethod
    def send_message(cls, message: str):
        print(f"message {message} to {len(cls.clients)}")
        for client in cls.clients:
            client.write_message(message)

    def on_message(self, message):
        print("received", message)

    def check_origin(self, origin):
        return True

def main():

    app = tornado.web.Application([("/websocket", WebSocketHandler)])
    app.listen(8000)

    io_loop = tornado.ioloop.IOLoop.current()

    def send():
        WebSocketHandler.send_message("hello!"), 500
        # print("send hello!")

    periodic_callback = tornado.ioloop.PeriodicCallback(send, 500)
    periodic_callback.start()

    # io_loop.start()
    # application = web.Application([('/websocket', WebSocketHandler)])
    # application.listen(8001)
    # ioloop.IOLoop.instance().start()

    t = Thread(target=io_loop.start)
    t.daemon = True
    t.start()

    #
    # box = geometry.Box([0.5, 0.5, 0.5])
    # print("add_callback")
    # io_loop.add_callback(lambda: vis.set_object(box))
    # io_loop.add_callback(lambda: vis.set_property(Path(("Background",)), "top_color", [1, 0, 0]))


    run = True
    while run:
        clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False
            if event.type == pygame.KEYDOWN:
                print(pygame.key.name(event.key))

        keys = pygame.key.get_pressed()

        rect.x += (keys[pygame.K_RIGHT] - keys[pygame.K_LEFT]) * vel
        rect.y += (keys[pygame.K_DOWN] - keys[pygame.K_UP]) * vel

        rect.centerx = rect.centerx % window.get_width()
        rect.centery = rect.centery % window.get_height()

        window.fill(0)
        pygame.draw.rect(window, (255, 0, 0), rect)
        pygame.display.flip()

    pygame.quit()
    exit()

if __name__ == "__main__":
    main()
