# Микросервис pdf-splitter

Данный сервис предназачен для разрезания pdf-файлов на отдельные документы
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
* Описание: принимает pdf-файл, размер чанка (количество частей, на которые надо поделить файл), имя файла и отдает пачку файлов обратно
* Тип запроса: multipart/form-data
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
      "data": "JVBERi0xLjQK...",
      "fileName": "документ стр_1-4.pdf"
    }
  ]
  } 
  ```
  * Пример ответа при ошибках: 
  ```json
  {
  "success": false,
  "error": "PDF файл защищен паролем."
  }
  ```

### /split-pdf
* Описание: принимает pdf-файл, шаблон нарезки, имя файла и отдает пачку файлов обратно
* Тип запроса: multipart/form-data
Поля формы: 
* `pdf` - файл
* `template` - шаблон нарезки
* `originalFileName` - исходное название файла
  
* Возвращаемый JSON (пример успешного ответа):
  ```json
  {
  "success": true,
  "totalPages": 10,
  "totalLetters": 3,
  "processingTimeMs": 1200,
  "letters": [
    {
      "letterIndex": 1,
      "template": "1-3",
      "pages": [1, 2, 3],
      "pageCount": 3,
      "fileName": "документ письмо_стр_1,2,3.pdf",
      "size": 128000,
      "data": "JVBERi0xLjQK..."
    }
  ]
  }
  ```
  * Пример ответа при ошибках:
  ```json
  {
  "success": false,
  "error": "Шаблон нарезки не указан"
  }
  ```
## Коды и статусы:
* `200` - OK
* `400` — Bad Request (не передан файл, не указан шаблон, некорректный размер части, PDF защищен паролем, невалидный PDF, не удалось создать ни одного письма)
* `413` — Payload Too Large (файл больше 100 МБ)
* `500` — Internal Server Error (внутренняя ошибка сервера)

