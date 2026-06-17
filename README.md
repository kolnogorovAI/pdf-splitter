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



