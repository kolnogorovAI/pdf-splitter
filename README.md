# Микросервис pdf-splitter

Данный сервис предназначен для разрезания pdf-файлов на отдельные документы
---

# Пример публикации сервиса внутри Kubernetes в пространстве имен elma365-dev 
Для корректного размещения необходимо выполнить соледующие ssh-команды:
```bash
kubectl create deployment pdf-splitter --image=kolnogorov/pdf-splitter:latest -n elma365-dev

kubectl create service clusterip pdf-splitter --tcp=80:8082 -n elma365-dev
```
Данные команды создадут сервис типа ClusterIP и пробросят порт 80 на порт 8082 внутри контейнера. Сервис будет доступен только внутри кластера по адресу:
http://pdf-splitter.elma365-dev/


# Команды для проверки состояния сервиса по факту публикации
```bash

//Проверить статус пода
kubectl get pods -n elma365-dev -l app=pdf-splitter

//Проверить сервис
kubectl get svc -n elma365-dev pdf-splitter

```
# REST API
Сервис pdf-splitter предоставляет два основных метода: 
### /split-all 

Описание: принимает PDF-файл, размер чанка (количество частей, на которые надо поделить файл), имя файла. Возвращает отдельные PDF-файлы, количество которых равно количеству получившихся частей

Тип запроса: multipart/form-data
  
Поля формы: 
* `pdf` - файл
* `chunkSize` - количество частей
* `originalFileName` - исходное название файла
  
* Возвращаемый JSON (пример успешного ответа):
  ```json
  {
  "success": true,
  "totalParts": 3,
  "totalPages": 10,
  "chunkSize": 4,
  "processingTimeMs": 850,
  "parts": [
    {
      "partIndex": 1,
      "pageStart": 1,
      "pageEnd": 4,
      "size": 256000,
      "data": "JVBERi0xLjcKJYG...",
      "fileName": "документ стр_1-4.pdf"
    },
    {
      "partIndex": 2,
      "pageStart": 5,
      "pageEnd": 8,
      "size": 258000,
      "data": "JVBERi0xLjcKJYG...",
      "fileName": "документ стр_5-8.pdf"
    },
    {
      "partIndex": 3,
      "pageStart": 9,
      "pageEnd": 10,
      "size": 124000,
      "data": "JVBERi0xLjcKJYG...",
      "fileName": "документ стр_9-10.pdf"
      }
    ]
  } 
  ```
  * Пример ответа при ошибках: 
  ```json
  {
  "error": "PDF файл защищен паролем."
  }
  ```

### /split-pdf

Описание: принимает PDF-файл, шаблон нарезки, имя файла. Возвращает отдельные PDF-файлы, каждый из которых содержит страницы, указанные в соответствующем блоке шаблона

Тип запроса: multipart/form-data

Поля формы: 
* `pdf` - файл
* `template` - шаблон нарезки
* `originalFileName` - исходное название файла
  
* Возвращаемый JSON (пример успешного ответа):
  ```json
  {
  "success": true,
  "totalPages": 10,
  "totalLetters": 2,
  "processingTimeMs": 1200,
  "letters": [
    {
      "letterIndex": 1,
      "template": "1-5",
      "pages": [1,
                2,
                3,
                4,
                5],
      "pageCount": 5,
      "fileName": "документ письмо_стр_1,2,3,4,5.pdf",
      "size": 86547,
      "data": "JVBERi0xLjcKJYG..."
    },
    {
      "letterIndex": 2,
      "template": "6-10",
      "pages": [6,
                7,
                8,
                9,
                10],
      "pageCount": 5,
      "fileName": "документ письмо_стр_6,7,8,9,10.pdf",
      "size": 29378,
      "data": "JVBERi0xLjcKJYG..."
      }  
    ]
  }
  ```
  * Пример ответа при ошибках:
  ```json
  {
  "error": "Шаблон нарезки не указан"
  }
  ```
## Коды и статусы:
* `200` - OK
* `400` — Bad Request (не передан файл, не указан шаблон, некорректный размер части, PDF защищен паролем, невалидный PDF, не удалось создать ни одного письма)
* `413` — Payload Too Large (файл больше 100 МБ)
* `500` — Internal Server Error (внутренняя ошибка сервера)

