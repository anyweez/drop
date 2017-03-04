# dropd
*Easy LAN file sharing.*

dropd runs a small server that makes it really easy to share files on a trusted network. Users drag and drop files, which then become available for a specified period of time to other users. Once the period has passed, the file is automatically deleted.

No permanent state is maintained and only files that were created by the dropd server can be accessed and deleted.

## Installation and usage

```
npm install --global dropd
```

Once installed, you can run dropd from any directory. By default it will store any uploaded files in the working directory.

```
Configuration options

    --dir   Absolute path to the directory where dropped files should be stored
            default=process.cwd()
    --ttl   Seconds that uploaded files should exist or zero for forever
            default=60
```