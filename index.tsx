import { Component, ReactElement, ReactNode } from 'react';
import type { UploadProps } from 'antd';
import { Button, Upload as AntdUpload, UploadFile } from 'antd';
import SparkMD5 from 'spark-md5';
import { obsSignUrl } from '@/api/fileManagement';
import { bucketName } from '@/httpService/API';
import { Accept, UploadType } from 'grt-components';
import { addNode } from '@/api/api'
interface genUrlResult {
    success: boolean;
    data: string | undefined | null;
}

export interface Props {
    uploadItem?: ReactNode;
    uploadType?: UploadType;
    dirname?: string;
    className?: string;
    directory?: boolean;
    // eslint-disable-next-line no-unused-vars
    onChange?: (file: UploadFile, type?: any) => void | boolean | undefined;
    // eslint-disable-next-line no-unused-vars
    beforeUpload?: (file: UploadFile, name: string, md5: string, type?: any) => Promise<boolean | undefined | void>;
    // eslint-disable-next-line no-unused-vars
    processFunc?: (processNumber: number, file: UploadFile, xhr: XMLHttpRequest, obsResult: any) => void;
    // eslint-disable-next-line no-unused-vars
    completeFunc?: (obsResult: any, file: UploadFile) => void;
    // eslint-disable-next-line no-unused-vars
    errorFunc?: (error: any, file: UploadFile, obsResult: any) => void;
    // eslint-disable-next-line no-unused-vars
    itemRender?: (originNode: ReactElement, file: UploadFile, fileList: object[], actions: any) => ReactNode;
    maxSize?: number;
    multiple?: boolean;
}

type FileExtType = {
    [name: symbol]: string[];
};
type FileExtMap = {
    [name: number]: symbol;
};

export interface State {}

const FILE_EXT_SYMBOL_IMAGE = Symbol('IMAGE'),
    FILE_EXT_SYMBOL_VIDEO = Symbol('VIDEO'),
    FILE_EXT_SYMBOL_DOCS = Symbol('DOCS'),
    FILE_EXT_SYMBOL_AUDIO = Symbol('AUDIO'),
    FILE_EXT_SYMBOL_UNSET = Symbol('UNSET'),
    FILE_EXT_SYMBOL_USER_AVATAR = Symbol('USER_AVATAR');
export const FILE_EXT_MAP: FileExtMap = {
    [UploadType.IMAGE]: FILE_EXT_SYMBOL_IMAGE,
    [UploadType.DOCS]: FILE_EXT_SYMBOL_DOCS,
    [UploadType.VIDEO]: FILE_EXT_SYMBOL_VIDEO,
    [UploadType.AUDIO]: FILE_EXT_SYMBOL_AUDIO,
    [UploadType.USER_AVATAR]: FILE_EXT_SYMBOL_USER_AVATAR,
    [UploadType.UNSET]: FILE_EXT_SYMBOL_UNSET
};
export const FILE_EXT: FileExtType = {
    [FILE_EXT_SYMBOL_IMAGE]: ['jpg', 'gif', 'png', 'bmp', 'jpeg'],
    [FILE_EXT_SYMBOL_VIDEO]: ['mp4', 'mov', 'm4v', 'flv', 'wmv', 'avi', 'rmvb', '3gp', 'ts', 'mxv'],
    [FILE_EXT_SYMBOL_DOCS]: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'csv', 'txt', 'json'],
    [FILE_EXT_SYMBOL_AUDIO]: ['mp3', 'mpeg', 'wma', 'm4r', 'm4a', 'acc', 'ape', 'flac', 'amr', 'wav', 'wv', 'ogg'],
    [FILE_EXT_SYMBOL_USER_AVATAR]: ['jpg', 'png', 'jpeg'],
    [FILE_EXT_SYMBOL_UNSET]: [
        'jpg',
        'gif',
        'png',
        'bmp',
        'jpeg',
        'mp4',
        'mov',
        'm4v',
        'flv',
        'wmv',
        'avi',
        'rmvb',
        '3gp',
        'ts',
        'mxv',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'ppt',
        'pptx',
        'pdf',
        'csv',
        'txt',
        'json',
        'mp3',
        'mpeg',
        'wma',
        'm4r',
        'm4a',
        'acc',
        'ape',
        'flac',
        'amr',
        'wav',
        'wv',
        'ogg'
    ]
};
const DEFAULT_HEADERS = { 'Content-Type': 'multipart/form-data' };

class ServiceUpload extends Component<Props, State> {
    state: State = {};

    async getUploadSignUrl(api: string, bucket_name: string, object_key: string) {
        try {
            const token = localStorage.getItem('SUPERSONIC_TOKEN');
            const id = localStorage.getItem('SUPERSONIC_TENANT_ID');
            const objectKey =`${object_key}`
            console.log('wwwwwww',object_key)
            const result = await fetch(api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token || '',
                    'x-tenant-id': id || ''
                },
                body: JSON.stringify({
                    bucketName:bucket_name,
                    objectKey:objectKey,
                    method: 'PUT',
                    headers: DEFAULT_HEADERS
                })
            });
            return result.json();
        } catch (error) {
            console.error(error);
        }
    }

    xhrUploadFile(uploadUrl, file, headers: any = {}, obsResult: any = {}) {

        const xhr = new XMLHttpRequest();
        xhr.open('put', uploadUrl);
        for (let key in headers) {
            const value = headers[key];
            if (key) {
                xhr.setRequestHeader(key, value);
            }
        }
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                console.debug('process:', event.loaded / event.total);
                if (this.props.processFunc) this.props.processFunc(event.loaded / event.total, file, xhr, obsResult);
            }
        };
        xhr.onerror = (err) => {
            if (this.props.errorFunc) {
                console.error(err);
                this.props.errorFunc(err, file, obsResult);
            }
        };
        xhr.onload = () => {
            if (xhr.status === 200) {
                if (this.props.completeFunc) {
                    console.debug('complete:');
                    const url: string = xhr.responseURL;
                    obsResult.fileUrl = url.substring(0, url.indexOf('?'));
                    this.props.completeFunc(obsResult, file);
                }
            }
        };
        xhr.send(file);
        return xhr;
    }

    get uploadItem(): ReactNode {
        return this.props.uploadItem ? this.props.uploadItem : <Button>上传</Button>;
    }

    getAccept(type): Accept {
        let accept: Accept = Accept.UNSET;
        switch (type) {
            case UploadType.AUDIO:
                accept = Accept.AUDIO;
                break;
            case UploadType.DOCS:
                accept = Accept.DOCS;
                break;
            case UploadType.IMAGE:
                accept = Accept.IMAGE;
                break;
            case UploadType.VIDEO:
                accept = Accept.VIDEO;
                break;
            case UploadType.UNSET:
                accept = Accept.UNSET;
                break;
            case UploadType.USER_AVATAR:
                accept = Accept.USER_AVATAR;
                break;
        }
        return accept;
    }

    getFileMD5(file) {
        return new Promise((resolve) => {
            if (file && file.size < 2 * 1024 * 1024) {
                const fileReader = new FileReader();
                fileReader.readAsBinaryString(file);
                fileReader.onload = (e: any) => {
                    resolve(SparkMD5.hashBinary(e.target.result));
                };
                return;
            }
            const sliceLength = 10,
                chunkSize = Math.ceil(file.size / sliceLength),
                fileReader = new FileReader(),
                md5 = new SparkMD5();
            let index = 0,
                loadFile: () => void;
            loadFile = () => {
                const slice = file.slice(index, index + chunkSize);
                fileReader.readAsBinaryString(slice);
            };
            loadFile();
            fileReader.onload = (e: any) => {
                md5.appendBinary(e.target.result);
                if (index < file.size) {
                    index += chunkSize;
                    loadFile();
                } else {
                    resolve(md5.end());
                }
            };
        });
    }

    uploadOption: UploadProps = {
        accept: this.getAccept(this.props.uploadType),
        itemRender: this.props.itemRender || (() => null),
        beforeUpload() {
            return false;
        },
        multiple: this.props.multiple || false,
        directory: this.props.directory || false,
        onChange: async ({ file }) => {
            if (file.status) return false;
            const { name } = file;
            let { fileExt, fileName } = this.getFileExtAndName(name);
            
            // 获取文件夹路径信息（目录上传时）
            const relativePath = (file as any).webkitRelativePath || '';
            const pathParts = relativePath.split('/').filter((p: string) => p);
            const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
            
            const uploadType = this.props.uploadType || UploadType.UNSET,
                fileType: UploadType = this.getFileTypeByExt(fileExt);
            if (uploadType !== undefined && uploadType !== null) {
                const fileExtMap = FILE_EXT_MAP[uploadType];
                if (!fileExtMap) {
                    if (this.props.errorFunc) {
                        this.props.errorFunc(
                            {
                                message: '文件格式不支持',
                                size: file.size,
                                maxSize: this.props.maxSize
                            },
                            file,
                            {}
                        );
                    }
                    return false;
                }
                const extList = FILE_EXT[fileExtMap];
                if (fileExt && !extList.includes(fileExt.toLowerCase())) {
                    if (this.props.errorFunc) {
                        this.props.errorFunc(
                            {
                                message: '文件格式不支持',
                                size: file.size,
                                maxSize: this.props.maxSize
                            },
                            file,
                            {}
                        );
                    }
                    return false;
                }
            }
            if (this.props.onChange) {
                const changeFlag = this.props.onChange(file, fileType);
                if (!changeFlag && changeFlag !== undefined) return false;
            }
            if (this.props.maxSize && file.size && file.size > this.props.maxSize) {
                if (this.props.errorFunc) {
                    this.props.errorFunc(
                        {
                            message: '文件大小超出限制',
                            size: file.size,
                            maxSize: this.props.maxSize
                        },
                        file,
                        {}
                    );
                }
                return false;
            }
            await this.getFileMD5(file).then(async (md5) => {
                const id = localStorage.getItem('SUPERSONIC_TENANT_ID');
                const rename = md5 + '.' + fileExt;
                const objectKey = `input/${id}/${rename}`;
                const folderPrefix = folderPath ? folderPath + '/' : '';
                const fileKey =
                        (fileType === UploadType.VIDEO || fileType === UploadType.AUDIO) && this.props.dirname
                            ? this.props.dirname + '/' + folderPrefix + rename
                            : this.props.dirname
                            ? this.props.dirname + '/' + folderPrefix + rename
                            : objectKey,
                    bucket = fileType === UploadType.VIDEO ? bucketName.video : fileType === UploadType.AUDIO ? bucketName.audio : bucketName.other,
                    { result, success } = await this.getUploadSignUrl(obsSignUrl, bucket, fileKey);

                console.log('objectKey', objectKey)
                if (!success) return false;
                if (this.props.beforeUpload) {
                    const beforeFlag = await this.props.beforeUpload(file, fileKey, md5 as string, fileType);
                    if (!beforeFlag && beforeFlag !== undefined) return false;
                }
                 console.log(fileKey,'fileKey')
                this.xhrUploadFile(result, file, DEFAULT_HEADERS, {
                    bucketName: bucket,
                    objectKey: fileKey,
                    md5,
                    ext: fileExt,
                    fileName,
                    fileType,
                    folderPath: folderPath
                });
            });
        }
    };

    getFileTypeByExt(ext: string) {
        ext = ext.toLowerCase();
        const extList = FILE_EXT;
        if (extList[FILE_EXT_SYMBOL_VIDEO].includes(ext)) return UploadType.VIDEO;
        else if (extList[FILE_EXT_SYMBOL_AUDIO].includes(ext)) return UploadType.AUDIO;
        else if (extList[FILE_EXT_SYMBOL_IMAGE].includes(ext)) return UploadType.IMAGE;
        else if (extList[FILE_EXT_SYMBOL_DOCS].includes(ext)) return UploadType.DOCS;
        return UploadType.UNSET;
    }

    getFileExtAndName(fileName: string) {
        const index = fileName.lastIndexOf('.'),
            ext = fileName.substring(index + 1),
            name = fileName.substring(0, index);
        return { fileExt: ext, fileName: name };
    }

    render(): ReactNode {
        return <AntdUpload {...this.uploadOption}>{this.uploadItem}</AntdUpload>;
    }
}

export default ServiceUpload;
export const getDownloadSignUrl = async (bucket_name: string, object_key: string): Promise<genUrlResult> => {
    try {
        const token = localStorage.getItem('SUPERSONIC_TOKEN');
        const id = localStorage.getItem('SUPERSONIC_TENANT_ID');
        const objectKey =`input/${id}/${object_key}`
        const result = await fetch(obsSignUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token || ''
            },
            body: JSON.stringify({
                bucketName:bucket_name,
                objectKey:objectKey,
                method: 'GET'
            })
        });
        return result.json().then((res) => {
            const { success, data } = res;
            if (!success) return { success: false, data: null };
            return { success: true, data };
        });
    } catch (error) {
        console.error(error);
        return { success: false, data: JSON.stringify(error) };
    }
};
